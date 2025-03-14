// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DemetraShoes is ERC721, Ownable {
    error MintFailed();
    error NotTokenOwnerOrApproved();
    error InvalidMintAmount();
    error MaxSupplyExceeded();
    error InsufficientPayment();

    uint256 public constant MINT_PRICE = 0.001 ether;
    uint256 public constant MAX_SUPPLY = 100;  
    uint256 public constant MAX_MINT_PER_TX = 3;
    
    uint256 private s_tokenCounter;
    bool public mintingEnabled = true;
    
    struct ShoeAttributes {
        uint256 randomNumber;      
        uint256 sustainabilityScore; 
        uint256 rarity;           
        uint256 discountLevel;    
        bool hqTourAccess;        
    }
    
    mapping(uint256 => ShoeAttributes) public shoeAttributes;
    mapping(uint256 => bool) private tokenExists;
    mapping(address => mapping(uint256 => bool)) private ownerTokens;
    
    event NFTMinted(uint256 indexed tokenId, address minter, ShoeAttributes attributes);
    event MintingStateChanged(bool enabled);
    event HQTourWinner(uint256 indexed tokenId, address winner);
    
    constructor() ERC721("Demetra Eco Shoes", "DMTR") Ownable(msg.sender) {
        s_tokenCounter = 0;
    }

    modifier whenMintingEnabled() {
        require(mintingEnabled, "Minting is disabled");
        _;
    }

    function mintNFT(uint256 numberOfTokens) public payable whenMintingEnabled {
        if(numberOfTokens == 0 || numberOfTokens > MAX_MINT_PER_TX) revert InvalidMintAmount();
        if(s_tokenCounter + numberOfTokens > MAX_SUPPLY) revert MaxSupplyExceeded();
        if(msg.value < MINT_PRICE * numberOfTokens) revert InsufficientPayment();

        uint256 startTokenId = s_tokenCounter;
        s_tokenCounter += numberOfTokens;

        for(uint256 i = 0; i < numberOfTokens; i++) {
            uint256 tokenId = startTokenId + i;
            uint256 randomNumber = uint256(keccak256(abi.encodePacked(
                block.timestamp,
                block.prevrandao,
                msg.sender,
                tokenId,
                blockhash(block.number - 1)
            )));
            
            ShoeAttributes memory attributes = generateShoeAttributes(randomNumber);
            shoeAttributes[tokenId] = attributes;
            
            _mint(msg.sender, tokenId);
            tokenExists[tokenId] = true;
            ownerTokens[msg.sender][tokenId] = true;
            
            emit NFTMinted(tokenId, msg.sender, attributes);
            
            if(attributes.hqTourAccess) {
                emit HQTourWinner(tokenId, msg.sender);
            }
        }
    }

    function generateShoeAttributes(uint256 randomNumber) private pure returns (ShoeAttributes memory) {
        uint256 rarity = (randomNumber % 100) + 1;
        
        uint256 sustainabilityScore = 70 + ((rarity * 30) / 100);
        
        uint256 discountLevel;
        if (rarity <= 40) {
            discountLevel = 1;
        } else if (rarity <= 80) {
            discountLevel = 2;
        } else {
            discountLevel = 3;
        }
        
        bool hasHQAccess = rarity > 95;

        return ShoeAttributes({
            randomNumber: randomNumber,
            sustainabilityScore: sustainabilityScore,
            rarity: rarity,
            discountLevel: discountLevel,
            hqTourAccess: hasHQAccess
        });
    }

    function getTokensByOwner(address owner) public view returns (uint256[] memory) {
        uint256 balance = balanceOf(owner);
        uint256[] memory result = new uint256[](balance);
        
        if (balance == 0) {
            return result;
        }
        
        uint256 resultIndex = 0;
        
        for (uint256 i = 0; i < s_tokenCounter && resultIndex < balance; i++) {
            if (tokenExists[i] && _ownerOf(i) == owner) {
                result[resultIndex] = i;
                resultIndex++;
            }
        }
        
        return result;
    }

    function getShoeAttributes(uint256 tokenId) public view returns (ShoeAttributes memory) {
        require(tokenExists[tokenId], "Token does not exist");
        return shoeAttributes[tokenId];
    }

    function getDiscountForToken(uint256 tokenId) public view returns (uint256) {
        require(tokenExists[tokenId], "Token does not exist");
        return shoeAttributes[tokenId].discountLevel * 10;
    }

    function hasHQTourAccess(uint256 tokenId) public view returns (bool) {
        require(tokenExists[tokenId], "Token does not exist");
        return shoeAttributes[tokenId].hqTourAccess;
    }

    function setMintingEnabled(bool enabled) external onlyOwner {
        mintingEnabled = enabled;
        emit MintingStateChanged(enabled);
    }

    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Transfer failed");
    }

    function _update(address to, uint256 tokenId, address auth) 
        internal 
        override 
        returns (address from) 
    {
        from = super._update(to, tokenId, auth);
        
        if (from != address(0)) {
            ownerTokens[from][tokenId] = false;
        }
        
        if (to != address(0)) {
            ownerTokens[to][tokenId] = true;
        } else {
            tokenExists[tokenId] = false;
        }
        
        return from;
    }

    function burnNFT(uint256 tokenId) public {
        address owner = _ownerOf(tokenId);
        if(owner != msg.sender && getApproved(tokenId) != msg.sender) 
            revert NotTokenOwnerOrApproved();
        
        delete shoeAttributes[tokenId];
        tokenExists[tokenId] = false;
        ownerTokens[owner][tokenId] = false;
        
        _burn(tokenId);
    }

    function getCurrentTokenCount() public view returns (uint256) {
        return s_tokenCounter;
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}