const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DemetraShoes", function () {
    let demetraShoes;
    let owner;
    let addr1;
    let addr2;

    const MINT_PRICE = ethers.parseEther("0.001");
    const MAX_SUPPLY = 100;
    const MAX_MINT_PER_TX = 3;

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();

        const DemetraShoes = await ethers.getContractFactory("DemetraShoes");
        demetraShoes = await DemetraShoes.deploy();
        await demetraShoes.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            expect(await demetraShoes.owner()).to.equal(owner.address);
        });

        it("Should have correct name and symbol", async function () {
            expect(await demetraShoes.name()).to.equal("Demetra Eco Shoes");
            expect(await demetraShoes.symbol()).to.equal("DMTR");
        });
    });

    describe("Minting", function () {
        it("Should fail if not enough ETH is sent", async function () {
            await expect(
                demetraShoes.mintNFT(1, { value: ethers.parseEther("0.0001") })
            ).to.be.revertedWithCustomError(demetraShoes, "InsufficientPayment");
        });

        it("Should mint NFT when correct amount is sent", async function () {
            await demetraShoes.mintNFT(1, { value: MINT_PRICE });
            expect(await demetraShoes.ownerOf(0)).to.equal(owner.address);
        });

        it("Should fail if trying to mint more than MAX_MINT_PER_TX", async function () {
            const mintPrice = MINT_PRICE * BigInt(MAX_MINT_PER_TX + 1);
            await expect(
                demetraShoes.mintNFT(MAX_MINT_PER_TX + 1, { value: mintPrice })
            ).to.be.revertedWithCustomError(demetraShoes, "InvalidMintAmount");
        });

        it("Should mint multiple NFTs in one transaction", async function () {
            const mintPrice = MINT_PRICE * BigInt(3);
            await demetraShoes.mintNFT(3, { value: mintPrice });
            expect(await demetraShoes.ownerOf(0)).to.equal(owner.address);
            expect(await demetraShoes.ownerOf(1)).to.equal(owner.address);
            expect(await demetraShoes.ownerOf(2)).to.equal(owner.address);
        });
    });

    describe("Shoe Attributes", function () {
        beforeEach(async function () {
            await demetraShoes.mintNFT(1, { value: MINT_PRICE });
        });

        it("Should generate valid sustainability score", async function () {
            const attributes = await demetraShoes.getShoeAttributes(0);
            expect(Number(attributes.sustainabilityScore)).to.be.above(69);
            expect(Number(attributes.sustainabilityScore)).to.be.below(101);
        });

        it("Should generate valid rarity", async function () {
            const attributes = await demetraShoes.getShoeAttributes(0);
            expect(Number(attributes.rarity)).to.be.above(0);
            expect(Number(attributes.rarity)).to.be.below(101);
        });

        it("Should generate valid discount level", async function () {
            const attributes = await demetraShoes.getShoeAttributes(0);
            expect(Number(attributes.discountLevel)).to.be.above(0);
            expect(Number(attributes.discountLevel)).to.be.below(4);
        });

        it("Should correctly calculate discount percentage", async function () {
            const discount = await demetraShoes.getDiscountForToken(0);
            expect(Number(discount)).to.be.above(0);
            expect(Number(discount)).to.be.below(31);
            expect(Number(discount) % 10).to.equal(0);
        });
    });

    describe("HQ Tour Access", function () {
        it("Should properly track HQ tour access", async function () {
            const mintPrice = MINT_PRICE * BigInt(MAX_MINT_PER_TX);
            await demetraShoes.mintNFT(MAX_MINT_PER_TX, { value: mintPrice });
            
            for(let i = 0; i < MAX_MINT_PER_TX; i++) {
                const hasAccess = await demetraShoes.hasHQTourAccess(i);
                const attributes = await demetraShoes.getShoeAttributes(i);
                expect(hasAccess).to.equal(attributes.hqTourAccess);
                if(hasAccess) {
                    expect(Number(attributes.rarity)).to.be.above(95);
                }
            }
        });
    });

    describe("Burning", function () {
        beforeEach(async function () {
            await demetraShoes.mintNFT(1, { value: MINT_PRICE });
        });

        it("Should allow owner to burn their NFT", async function () {
            await demetraShoes.burnNFT(0);
            await expect(demetraShoes.ownerOf(0)).to.be.reverted;
        });

        it("Should not allow non-owner to burn NFT", async function () {
            await expect(
                demetraShoes.connect(addr1).burnNFT(0)
            ).to.be.revertedWithCustomError(demetraShoes, "NotTokenOwnerOrApproved");
        });

        it("Should delete shoe attributes when burned", async function () {
            await demetraShoes.burnNFT(0);
            await expect(demetraShoes.getShoeAttributes(0))
                .to.be.revertedWith("Token does not exist");
        });
    });

    describe("Withdrawals", function () {
        it("Should allow owner to withdraw", async function () {
            await demetraShoes.mintNFT(1, { value: MINT_PRICE });
            const initialBalance = await ethers.provider.getBalance(owner.address);
            await demetraShoes.withdraw();
            const finalBalance = await ethers.provider.getBalance(owner.address);
            expect(finalBalance).to.be.above(initialBalance);
        });

        it("Should not allow non-owner to withdraw", async function () {
            await expect(
                demetraShoes.connect(addr1).withdraw()
            ).to.be.reverted;
        });
    });

    describe("Supply Management", function () {
        it("Should not allow minting beyond MAX_SUPPLY", async function () {
            const batchSize = 3;
            const iterations = Math.ceil(MAX_SUPPLY / batchSize);
            const mintPrice = MINT_PRICE * BigInt(batchSize);

            for (let i = 0; i < iterations - 1; i++) {
                await demetraShoes.mintNFT(batchSize, { value: mintPrice });
            }

            const remainingTokens = MAX_SUPPLY % batchSize;
            if (remainingTokens > 0) {
                const finalMintPrice = MINT_PRICE * BigInt(remainingTokens);
                await demetraShoes.mintNFT(remainingTokens, { value: finalMintPrice });
            }

            await expect(
                demetraShoes.mintNFT(1, { value: MINT_PRICE })
            ).to.be.revertedWithCustomError(demetraShoes, "MaxSupplyExceeded");
        });
    });

    describe("Token Transfers", function () {
        beforeEach(async function () {
            await demetraShoes.mintNFT(1, { value: MINT_PRICE });
        });

        it("Should maintain shoe attributes after transfer", async function () {
            const attributesBefore = await demetraShoes.getShoeAttributes(0);
            await demetraShoes.transferFrom(owner.address, addr1.address, 0);
            const attributesAfter = await demetraShoes.getShoeAttributes(0);
            
            expect(Number(attributesAfter.sustainabilityScore))
                .to.equal(Number(attributesBefore.sustainabilityScore));
            expect(Number(attributesAfter.rarity))
                .to.equal(Number(attributesBefore.rarity));
            expect(Number(attributesAfter.discountLevel))
                .to.equal(Number(attributesBefore.discountLevel));
            expect(attributesAfter.hqTourAccess)
                .to.equal(attributesBefore.hqTourAccess);
        });
    });

    describe("Minting State", function () {
        it("Should allow toggling minting state", async function () {
            await demetraShoes.setMintingEnabled(false);
            await expect(
                demetraShoes.mintNFT(1, { value: MINT_PRICE })
            ).to.be.revertedWith("Minting is disabled");

            await demetraShoes.setMintingEnabled(true);
            await demetraShoes.mintNFT(1, { value: MINT_PRICE });
            expect(await demetraShoes.ownerOf(0)).to.equal(owner.address);
        });

        it("Should only allow owner to toggle minting state", async function () {
            await expect(
                demetraShoes.connect(addr1).setMintingEnabled(false)
            ).to.be.reverted;
        });
    });
});