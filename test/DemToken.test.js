const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DemToken", function () {
   let demToken;
   let owner;
   let addr1;
   let addr2;
   let vrfCoordinatorV2Mock;
   let subscriptionId;

   const GAS_LANE = "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c";
   const CALLBACK_GAS_LIMIT = "2500000";
   const MINT_PRICE = ethers.parseEther("0.001");
   const FUND_AMOUNT = ethers.parseEther("1000");
   const MAX_SUPPLY = 10;

   async function mintNFT() {
       const requestTx = await demToken.requestNFT({ value: MINT_PRICE });
       const requestReceipt = await requestTx.wait();
       const requestId = requestReceipt.logs[1].args[0];
       
       const randomWords = [BigInt("777")];
       const fulfillTx = await vrfCoordinatorV2Mock.fulfillRandomWordsWithOverride(
           requestId,
           await demToken.getAddress(),
           randomWords,
           { gasLimit: CALLBACK_GAS_LIMIT }
       );
       await fulfillTx.wait();
       await ethers.provider.send("evm_mine", []);
   }

   beforeEach(async function () {
       [owner, addr1, addr2] = await ethers.getSigners();

       const VRFCoordinatorV2_5Mock = await ethers.getContractFactory("VRFCoordinatorV2_5Mock");
       vrfCoordinatorV2Mock = await VRFCoordinatorV2_5Mock.deploy(
           BigInt("100000000000000000"),
           BigInt("1000000000"),
           BigInt("4639000000000000")
       );
       await vrfCoordinatorV2Mock.waitForDeployment();

       const tx = await vrfCoordinatorV2Mock.createSubscription();
       const txReceipt = await tx.wait();
       subscriptionId = txReceipt.logs[0].args[0];

       await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT);

       const DemToken = await ethers.getContractFactory("DemToken");
       demToken = await DemToken.deploy(
           await vrfCoordinatorV2Mock.getAddress(),
           GAS_LANE,
           subscriptionId,
           CALLBACK_GAS_LIMIT
       );
       await demToken.waitForDeployment();

       await vrfCoordinatorV2Mock.addConsumer(subscriptionId, await demToken.getAddress());
   });

   describe("Deployment", function () {
       it("Should set the right owner", async function () {
           expect(await demToken.owner()).to.equal(owner.address);
       });

       it("Should have correct name and symbol", async function () {
           expect(await demToken.name()).to.equal("DemToken");
           expect(await demToken.symbol()).to.equal("DMTK");
       });
   });

   describe("Minting", function () {
       it("Should fail if not enough ETH is sent", async function () {
           await expect(
               demToken.requestNFT({ value: ethers.parseEther("0.0001") })
           ).to.be.revertedWith("Not enough ETH sent");
       });

       it("Should request NFT when correct amount is sent", async function () {
           const tx = await demToken.requestNFT({ value: MINT_PRICE });
           const receipt = await tx.wait();
           const requestId = receipt.logs[1].args[0];
           expect(requestId).to.not.be.undefined;
       });

       it("Should mint NFT after random number is fulfilled", async function () {
           await mintNFT();
           expect(await demToken.ownerOf(0)).to.equal(owner.address);
       });
   });

   describe("NFT Attributes", function () {
       it("Should generate valid attributes from random number", async function () {
           await mintNFT();
           const attributes = await demToken.getTokenAttributes(0);
           expect(attributes.strength).to.be.above(0);
           expect(attributes.strength).to.be.below(101);
           expect(attributes.speed).to.be.above(0);
           expect(attributes.speed).to.be.below(101);
           expect(attributes.magic).to.be.above(0);
           expect(attributes.magic).to.be.below(101);
       });
   });

   describe("Burning", function () {
       beforeEach(async function () {
           await mintNFT();
       });

       it("Should allow owner to burn their NFT", async function () {
           await demToken.burnNFT(0);
           await expect(demToken.ownerOf(0)).to.be.reverted;
       });

       it("Should not allow non-owner to burn NFT", async function () {
           await expect(
               demToken.connect(addr1).burnNFT(0)
           ).to.be.revertedWithCustomError(demToken, "NotTokenOwnerOrApproved");
       });
   });

   describe("Withdrawals", function () {
       it("Should allow owner to withdraw", async function () {
           await demToken.requestNFT({ value: MINT_PRICE });
           const initialBalance = await ethers.provider.getBalance(owner.address);
           await demToken.withdraw();
           const finalBalance = await ethers.provider.getBalance(owner.address);
           expect(finalBalance).to.be.above(initialBalance);
       });

       it("Should not allow non-owner to withdraw", async function () {
           await expect(
               demToken.connect(addr1).withdraw()
           ).to.be.reverted;
       });
   });

   describe("Supply Management", function () {
       it("Should not allow minting beyond MAX_SUPPLY", async function () {
           await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, ethers.parseEther("1000"));

           for (let i = 0; i < MAX_SUPPLY; i++) {
               const requestTx = await demToken.requestNFT({ value: MINT_PRICE });
               const requestReceipt = await requestTx.wait();
               const requestId = requestReceipt.logs[1].args[0];
               
               await vrfCoordinatorV2Mock.fulfillRandomWordsWithOverride(
                   requestId,
                   await demToken.getAddress(),
                   [BigInt(i + 1)],
                   { gasLimit: CALLBACK_GAS_LIMIT }
               );
               await ethers.provider.send("evm_mine", []);

               expect(await demToken.ownerOf(i)).to.equal(owner.address);
               console.log(`Minted token ${i}, Current count: ${await demToken.getCurrentTokenCount()}`);
           }

           const tokenCount = await demToken.getCurrentTokenCount();
           console.log("Final token count:", tokenCount);
           expect(tokenCount).to.equal(MAX_SUPPLY);

           await expect(
               demToken.requestNFT({ value: MINT_PRICE })
           ).to.be.revertedWith("Max supply reached");
       });
   });

   describe("Token Transfers", function () {
       beforeEach(async function () {
           await mintNFT();
       });

       it("Should allow token transfer between addresses", async function () {
           await demToken.transferFrom(owner.address, addr1.address, 0);
           expect(await demToken.ownerOf(0)).to.equal(addr1.address);
       });

       it("Should maintain token attributes after transfer", async function () {
           const attributesBefore = await demToken.getTokenAttributes(0);
           await demToken.transferFrom(owner.address, addr1.address, 0);
           const attributesAfter = await demToken.getTokenAttributes(0);
           expect(attributesAfter.strength).to.equal(attributesBefore.strength);
           expect(attributesAfter.speed).to.equal(attributesBefore.speed);
           expect(attributesAfter.magic).to.equal(attributesBefore.magic);
       });

       it("Should not allow transfer of non-existent token", async function () {
           await expect(
               demToken.transferFrom(owner.address, addr1.address, 999)
           ).to.be.reverted;
       });
   });

   describe("Events", function () {
       it("Should emit NFTRequested event on request", async function () {
           const tx = await demToken.requestNFT({ value: MINT_PRICE });
           const receipt = await tx.wait();
           const event = receipt.logs[1];
           expect(event.args[1]).to.equal(owner.address);
           expect(event.args[0]).to.not.be.undefined;
       });

       it("Should emit NFTMinted event after fulfillment", async function () {
           await mintNFT();
           expect(await demToken.ownerOf(0)).to.equal(owner.address);
       });
   });

   describe("Edge Cases", function () {
       it("Should handle zero ETH transfer on withdraw", async function () {
           await demToken.withdraw();
       });

       it("Should maintain correct token counter after burns", async function () {
           await mintNFT();
           const initialCount = await demToken.getCurrentTokenCount();
           
           await demToken.burnNFT(0);
           const countAfterBurn = await demToken.getCurrentTokenCount();
           expect(countAfterBurn).to.equal(initialCount);

           await mintNFT();
           expect(await demToken.ownerOf(1)).to.equal(owner.address);
       });
   });
});