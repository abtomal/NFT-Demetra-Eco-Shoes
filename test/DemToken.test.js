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
            
            // Verifica che il token sia nel mapping personalizzato
            const ownerTokens = await demetraShoes.getTokensByOwner(owner.address);
            expect(ownerTokens.length).to.equal(1);
            expect(Number(ownerTokens[0])).to.equal(0);
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
            
            for(let i = 0; i < 3; i++) {
                expect(await demetraShoes.ownerOf(i)).to.equal(owner.address);
            }
            
            // Verifica che tutti i token siano nel mapping personalizzato
            const ownerTokens = await demetraShoes.getTokensByOwner(owner.address);
            expect(ownerTokens.length).to.equal(3);
            
            // Verifica che l'array contenga tutti i token corretti
            const tokenIds = ownerTokens.map(t => Number(t)).sort((a, b) => a - b);
            expect(tokenIds).to.deep.equal([0, 1, 2]);
        });

        it("Should handle concurrent minting properly", async function () {
            // mint contemporanei
            await Promise.all([
                demetraShoes.mintNFT(2, { value: MINT_PRICE * BigInt(2) }),
                demetraShoes.connect(addr1).mintNFT(2, { value: MINT_PRICE * BigInt(2) })
            ]);
            
            const totalTokens = await demetraShoes.getCurrentTokenCount();
            expect(totalTokens).to.equal(4);
            
            // ogni token abbia un proprietario
            for(let i = 0; i < 4; i++) {
                const owner = await demetraShoes.ownerOf(i);
                expect(owner).to.not.equal(ethers.ZeroAddress);
            }
            
            // Verifica mappings personalizzati
            const ownerTokens = await demetraShoes.getTokensByOwner(owner.address);
            const addr1Tokens = await demetraShoes.getTokensByOwner(addr1.address);
            
            // Verifica che i token siano assegnati correttamente
            expect(ownerTokens.length + addr1Tokens.length).to.equal(4);
        });
    });

    describe("Shoe Attributes Correlation", function () {
        beforeEach(async function () {
            await demetraShoes.mintNFT(3, { value: MINT_PRICE * BigInt(3) });
        });

        it("Should generate valid rarity values", async function () {
            for (let i = 0; i < 3; i++) {
                const attributes = await demetraShoes.getShoeAttributes(i);
                expect(Number(attributes.rarity)).to.be.above(0);
                expect(Number(attributes.rarity)).to.be.below(101);
            }
        });

        it("Should correlate sustainability score with rarity", async function () {
            for (let i = 0; i < 3; i++) {
                const attributes = await demetraShoes.getShoeAttributes(i);
                const rarity = Number(attributes.rarity);
                const sustainabilityScore = Number(attributes.sustainabilityScore);
                
                const expectedScore = Math.floor(70 + ((rarity * 30) / 100));
                expect(sustainabilityScore).to.equal(expectedScore);
                
                expect(sustainabilityScore).to.be.above(69);
                expect(sustainabilityScore).to.be.below(101);
            }
        });

        it("Should correlate discount level with rarity ranges", async function () {
            for (let i = 0; i < 3; i++) {
                const attributes = await demetraShoes.getShoeAttributes(i);
                const rarity = Number(attributes.rarity);
                const discountLevel = Number(attributes.discountLevel);

                if (rarity <= 40) {
                    expect(discountLevel).to.equal(1);
                } else if (rarity <= 80) {
                    expect(discountLevel).to.equal(2);
                } else {
                    expect(discountLevel).to.equal(3);
                }
            }
        });

        it("Should only give HQ access to very rare NFTs", async function () {
            for (let i = 0; i < 3; i++) {
                const attributes = await demetraShoes.getShoeAttributes(i);
                const rarity = Number(attributes.rarity);
                const hasAccess = attributes.hqTourAccess;

                if (rarity > 95) {
                    expect(hasAccess).to.be.true;
                } else {
                    expect(hasAccess).to.be.false;
                }
            }
        });

        it("Should calculate correct discount percentages", async function () {
            for (let i = 0; i < 3; i++) {
                const attributes = await demetraShoes.getShoeAttributes(i);
                const discountLevel = Number(attributes.discountLevel);
                const discount = Number(await demetraShoes.getDiscountForToken(i));
                
                expect(discount).to.equal(discountLevel * 10);
                expect(discount).to.be.oneOf([10, 20, 30]);
            }
        });
    });

    describe("Token Ownership", function () {
        beforeEach(async function () {
            await demetraShoes.mintNFT(3, { value: MINT_PRICE * BigInt(3) });
        });

        it("Should return correct tokens for owner", async function () {
            const tokens = await demetraShoes.getTokensByOwner(owner.address);
            expect(tokens.length).to.equal(3);
            
            // Verifica che gli array contengano i token corretti
            const tokenIds = tokens.map(t => Number(t)).sort((a, b) => a - b);
            expect(tokenIds).to.deep.equal([0, 1, 2]);
        });

        it("Should handle transferred tokens correctly", async function () {
            await demetraShoes.transferFrom(owner.address, addr1.address, 1);
            
            const ownerTokens = await demetraShoes.getTokensByOwner(owner.address);
            expect(ownerTokens.length).to.equal(2);
            
            // Verifica che il token 1 non sia più nell'elenco dell'owner
            const ownerTokenIds = ownerTokens.map(t => Number(t)).sort((a, b) => a - b);
            expect(ownerTokenIds).to.not.include(1);
            expect(ownerTokenIds).to.deep.equal([0, 2]);
            
            const addr1Tokens = await demetraShoes.getTokensByOwner(addr1.address);
            expect(addr1Tokens.length).to.equal(1);
            expect(Number(addr1Tokens[0])).to.equal(1);
        });

        it("Should handle burned tokens correctly", async function () {
            await demetraShoes.burnNFT(1);
            
            const tokens = await demetraShoes.getTokensByOwner(owner.address);
            expect(tokens.length).to.equal(2);
            
            // Verifica che il token 1 non sia più nell'elenco
            const tokenIds = tokens.map(t => Number(t)).sort((a, b) => a - b);
            expect(tokenIds).to.not.include(1);
            expect(tokenIds).to.deep.equal([0, 2]);
        });

        it("Should handle multiple transfers efficiently", async function() {
            // Brucia tutti i token esistenti
            for (let i = 0; i < 3; i++) {
                await demetraShoes.burnNFT(i);
            }
            
            // Minta nuovi token
            await demetraShoes.mintNFT(3, { value: MINT_PRICE * BigInt(3) });
            await demetraShoes.mintNFT(2, { value: MINT_PRICE * BigInt(2) });
            
            // Trasferisci alcuni token
            await demetraShoes.transferFrom(owner.address, addr1.address, 3);
            await demetraShoes.transferFrom(owner.address, addr1.address, 5);
            await demetraShoes.connect(addr1).transferFrom(addr1.address, owner.address, 3);
            
            // Verifica ownership
            const ownerTokens = await demetraShoes.getTokensByOwner(owner.address);
            const addr1Tokens = await demetraShoes.getTokensByOwner(addr1.address);
            
            expect(ownerTokens.length).to.equal(4);
            expect(addr1Tokens.length).to.equal(1);
            
            const ownerTokenIds = ownerTokens.map(t => Number(t)).sort((a, b) => a - b);
            expect(ownerTokenIds).to.include(3);
            expect(ownerTokenIds).to.not.include(5);
            
            const addr1TokenIds = addr1Tokens.map(t => Number(t));
            expect(addr1TokenIds[0]).to.equal(5);
        });
    });

    describe("Burning", function () {
        beforeEach(async function () {
            await demetraShoes.mintNFT(1, { value: MINT_PRICE });
        });

        it("Should allow owner to burn their NFT", async function () {
            await demetraShoes.burnNFT(0);
            await expect(demetraShoes.ownerOf(0)).to.be.reverted;
            
            // Verifica che il token sia stato rimosso dal mapping personalizzato
            const ownerTokens = await demetraShoes.getTokensByOwner(owner.address);
            expect(ownerTokens.length).to.equal(0);
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
        
        it("Should update ownership mappings after transfer", async function() {
            await demetraShoes.transferFrom(owner.address, addr1.address, 0);
            
            // Verifica che il token sia stato rimosso dall'elenco dell'owner
            const ownerTokens = await demetraShoes.getTokensByOwner(owner.address);
            expect(ownerTokens.length).to.equal(0);
            
            // Verifica che il token sia stato aggiunto all'elenco del ricevente
            const addr1Tokens = await demetraShoes.getTokensByOwner(addr1.address);
            expect(addr1Tokens.length).to.equal(1);
            expect(Number(addr1Tokens[0])).to.equal(0);
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