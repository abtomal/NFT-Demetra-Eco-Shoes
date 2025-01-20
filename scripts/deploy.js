async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const subscriptionId = BigInt("40937370639439159731812354805971090573835783165536100602368880444144951663469");

    console.log("Using subscription ID:", subscriptionId.toString());

    const vrfCoordinatorV2 = "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625";
    const gasLane = "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15";  
    const callbackGasLimit = "200000"; 

    console.log("Gas Limit:", callbackGasLimit);

    const DemToken = await ethers.getContractFactory("DemToken");
    const demToken = await DemToken.deploy(
        vrfCoordinatorV2,
        gasLane,
        subscriptionId,
        callbackGasLimit
    );

    await demToken.waitForDeployment();
    const deployedAddress = await demToken.getAddress();
    console.log("DemToken deployed to:", deployedAddress);

    console.log("Verifying contract...");
    await new Promise(resolve => setTimeout(resolve, 30000));

    try {
        await hre.run("verify:verify", {
            address: deployedAddress,
            constructorArguments: [
                vrfCoordinatorV2,
                gasLane,
                subscriptionId,
                callbackGasLimit
            ],
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