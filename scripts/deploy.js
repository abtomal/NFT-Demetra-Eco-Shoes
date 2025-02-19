async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const DemetraShoes = await ethers.getContractFactory("DemetraShoes");
    const demetraShoes = await DemetraShoes.deploy();

    await demetraShoes.waitForDeployment();
    const deployedAddress = await demetraShoes.getAddress();
    console.log("DemetraShoes deployed to:", deployedAddress);

    console.log("Verifying contract...");
    await new Promise(resolve => setTimeout(resolve, 30000));

    try {
        await hre.run("verify:verify", {
            address: deployedAddress,
            constructorArguments: [],
        });
        console.log("Contract verified successfully");
    } catch (error) {
        console.log("Error verifying contract:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });