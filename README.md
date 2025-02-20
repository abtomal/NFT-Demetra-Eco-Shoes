# DemetraShoes NFT Contract

Smart contract for Demetra's eco-friendly shoes NFT collection. Each NFT represents a unique digital asset with sustainability scores, rarity levels, and real-world benefits like discounts and exclusive experiences.

## Features

- Limited collection of 100 unique NFTs
- Sustainability scores (70-100)
- Rarity-based discount system (10-30%)
- Exclusive HQ tour access for rare NFTs
- Up to 3 NFTs per transaction
- Token ownership tracking

## Prerequisites

- Node.js
- npm
- Infura account
- Etherscan account

## Installation

1. Clone the repository:
```bash
git clone https://github.com/abtomal/NFT-Demetra-Eco-Shoes.git
cd NFT-Demetra-Eco-Shoes
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
INFURA_API_KEY=your_infura_api_key
PRIVATE_KEY=your_wallet_private_key
ETHERSCAN_API_KEY=your_etherscan_api_key
```

## Testing

Run the test suite:
```bash
npx hardhat test
```

This will run comprehensive tests covering:
- NFT minting
- Attribute generation
- Discount calculations
- Token transfers
- Access control
- Security features

## Deployment

To deploy to Sepolia testnet:

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

The script will:
1. Deploy the contract
2. Wait for deployment confirmation
3. Automatically verify the contract on Etherscan

## Technical Details

### Smart Contract Architecture

The contract uses:
- OpenZeppelin's ERC721 implementation
- Custom attribute generation system
- Rarity-based benefits distribution
- Secure ownership tracking

### Security Features

- Access control for administrative functions
- Transaction limits
- Supply cap
- Ownership verification
- Custom error handling
- Event emission for tracking

### Network Configuration

Currently supports:
- Sepolia testnet
- Hardhat local network

## Project Structure

```
├── contracts/
│   └── DemToken.sol
├── scripts/
│   └── deploy.js
├── test/
│   └── DemetraShoes.test.js
├── hardhat.config.js
└── .env
```

## Dependencies

Main dependencies include:
- @openzeppelin/contracts: ^5.1.0
- hardhat: ^2.22.17
- ethers: ^6.13.4

Check package.json for complete list.



DEPLOYED AT: https://sepolia.etherscan.io/address/0x044eF83BFe765a8e7D197C609E57eD64c5b50744#writeContract