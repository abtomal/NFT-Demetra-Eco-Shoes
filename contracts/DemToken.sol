// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import {IVRFCoordinatorV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/interfaces/IVRFCoordinatorV2Plus.sol";

contract DemToken is ERC721, VRFConsumerBaseV2Plus {
    using VRFV2PlusClient for VRFV2PlusClient.RandomWordsRequest;
    error InvalidRequestId();
    error MintFailed();
    error NotTokenOwnerOrApproved();

    IVRFCoordinatorV2Plus private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint256 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    uint256 public constant MINT_PRICE = 0.001 ether;
    uint256 public constant MAX_SUPPLY = 10; 
    uint256 private s_tokenCounter;
    
    struct NFTAttributes {
        uint256 randomNumber;
        uint256 strength;
        uint256 speed;
        uint256 magic;
    }
    mapping(uint256 => NFTAttributes) public tokenAttributes;
    mapping(uint256 => address) private s_requestIdToSender;

    event NFTRequested(uint256 indexed requestId, address requester);
    event NFTMinted(uint256 indexed tokenId, address minter, NFTAttributes attributes);
    event RandomnessFulfilled(uint256 requestId, uint256[] randomWords);
    event PreMint(address to, uint256 tokenId);
    event PostMint(address to, uint256 tokenId);

    constructor(
        address vrfCoordinator,
        bytes32 gasLane,
        uint256 subscriptionId,
        uint32 callbackGasLimit
    ) 
        ERC721("DemToken", "DMTK") 
        VRFConsumerBaseV2Plus(vrfCoordinator)
    {
        i_vrfCoordinator = IVRFCoordinatorV2Plus(vrfCoordinator);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_tokenCounter = 0;
    }

    function getCurrentTokenCount() public view returns (uint256) {
        return s_tokenCounter;
    }

    function requestNFT() public payable returns (uint256 requestId) {
        require(msg.value >= MINT_PRICE, "Not enough ETH sent");
        require(s_tokenCounter < MAX_SUPPLY, "Max supply reached");

        VRFV2PlusClient.RandomWordsRequest memory request = VRFV2PlusClient.RandomWordsRequest({
            keyHash: i_gasLane,
            subId: i_subscriptionId,
            requestConfirmations: REQUEST_CONFIRMATIONS,
            callbackGasLimit: i_callbackGasLimit,
            numWords: NUM_WORDS,
            extraArgs: VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: false}))
        });

        requestId = i_vrfCoordinator.requestRandomWords(request);
        s_requestIdToSender[requestId] = msg.sender;
        emit NFTRequested(requestId, msg.sender);
    }

    function fulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) internal override {
        address nftOwner = s_requestIdToSender[requestId];
        if (nftOwner == address(0)) revert InvalidRequestId();
        require(s_tokenCounter < MAX_SUPPLY, "Max supply reached in callback");

        emit RandomnessFulfilled(requestId, randomWords);

        uint256 tokenId = s_tokenCounter;
        NFTAttributes memory attributes = generateAttributes(randomWords[0]);
        tokenAttributes[tokenId] = attributes;
        
        emit PreMint(nftOwner, tokenId);
        _mint(nftOwner, tokenId);
        s_tokenCounter = s_tokenCounter + 1;
        emit PostMint(nftOwner, tokenId);
        emit NFTMinted(tokenId, nftOwner, attributes);
        
        delete s_requestIdToSender[requestId];
    }

    function generateAttributes(uint256 randomNumber) private pure returns (NFTAttributes memory) {
        return NFTAttributes({
            randomNumber: randomNumber,
            strength: (randomNumber % 100) + 1,
            speed: ((randomNumber >> 100) % 100) + 1,
            magic: ((randomNumber >> 200) % 100) + 1
        });
    }

    function getTokenAttributes(uint256 tokenId) public view returns (NFTAttributes memory) {
        if(!_exists(tokenId)) revert("Token does not exist");
        return tokenAttributes[tokenId];
    }

    function _exists(uint256 tokenId) internal view returns (bool) {
        try this.ownerOf(tokenId) returns (address) {
            return true;
        } catch {
            return false;
        }
    }

    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Transfer failed");
    }

    function _baseURI() internal pure override returns (string memory) {
        return "https://api.yourwebsite.com/api/token/";
    }

    function burnNFT(uint256 tokenId) public {
        if(ownerOf(tokenId) != msg.sender && getApproved(tokenId) != msg.sender) 
            revert NotTokenOwnerOrApproved();
        delete tokenAttributes[tokenId];
        _burn(tokenId);
    }
}