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

        uint256 tokenId = s_tokenCounter;
        for(uint256 i = 0; i < numberOfTokens; i++) {
            uint256 randomNumber = uint256(keccak256(abi.encodePacked(
                block.timestamp,
                block.prevrandao,
                msg.sender,
                tokenId + i,
                blockhash(block.number - 1)
            )));
            
            ShoeAttributes memory attributes = generateShoeAttributes(randomNumber);
            shoeAttributes[tokenId + i] = attributes;
            
            _mint(msg.sender, tokenId + i);
            emit NFTMinted(tokenId + i, msg.sender, attributes);
            
            if(attributes.hqTourAccess) {
                emit HQTourWinner(tokenId + i, msg.sender);
            }
        }
        
        s_tokenCounter += numberOfTokens;
    }

    function generateShoeAttributes(uint256 randomNumber) private pure returns (ShoeAttributes memory) {
        // Determinazione rarità (1-100)
        uint256 rarity = (randomNumber % 100) + 1;
        
        // Sustainability Score basato sulla rarità
        uint256 sustainabilityScore = 70 + ((rarity * 30) / 100);
        
        // Discount Level basato sulla rarità
        uint256 discountLevel;
        if (rarity <= 40) {
            discountLevel = 1;
        } else if (rarity <= 80) {
            discountLevel = 2;
        } else {
            discountLevel = 3;
        }
        
        // Tour HQ access per il top 5% rarity
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
        uint256 tokenCount = balanceOf(owner);
        uint256[] memory tokens = new uint256[](tokenCount);
        uint256 counter = 0;
        
        for(uint256 i = 0; i < s_tokenCounter; i++) {
            try this.ownerOf(i) returns (address currentOwner) {
                if(currentOwner == owner) {
                    tokens[counter] = i;
                    counter++;
                }
            } catch {
                continue; 
            }
        }
        
        return tokens;
    }

    function getShoeAttributes(uint256 tokenId) public view returns (ShoeAttributes memory) {
        require(_tokenExists(tokenId), "Token does not exist");
        return shoeAttributes[tokenId];
    }

    function _tokenExists(uint256 tokenId) private view returns (bool) {
        try this.ownerOf(tokenId) returns (address) {
            return true;
        } catch {
            return false;
        }
    }

    function getDiscountForToken(uint256 tokenId) public view returns (uint256) {
        require(_tokenExists(tokenId), "Token does not exist");
        return shoeAttributes[tokenId].discountLevel * 10;
    }

    function hasHQTourAccess(uint256 tokenId) public view returns (bool) {
        require(_tokenExists(tokenId), "Token does not exist");
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

    function burnNFT(uint256 tokenId) public {
        if(ownerOf(tokenId) != msg.sender && getApproved(tokenId) != msg.sender) 
            revert NotTokenOwnerOrApproved();
        delete shoeAttributes[tokenId];
        _burn(tokenId);
    }

    function getCurrentTokenCount() public view returns (uint256) {
        return s_tokenCounter;
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}