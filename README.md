# CollateralizedLoan

My final project for [Udacity's Blockchain Developer Nanodegree](https://udacity.com/enrollment/nd1310) program: an Ethereum smart contract which allows users to request and receive collateral-backed loans on the Ethereum blockchain. Deployed on the Sepolia testnet as transaction [0x97e4e1584366aa874b21c86c1977e755a2e37e493e328258ad99259546c2810f](https://sepolia.etherscan.io/tx/0x97e4e1584366aa874b21c86c1977e755a2e37e493e328258ad99259546c2810f).

To run locally:

<ol>
  <li>Run <code>git clone https://github.com/vrajkumar128/CollateralizedLoan.git</code>.</li>
  <li><code>cd</code> into the cloned directory and run <code>npm install</code>.</li>
  <li>Spin up a local Hardhat node using <code>npx hardhat node</code>.</li>
  <li>From another terminal, deploy the contract locally with <code>npx hardhat run scripts/deploy.js --network localhost</code>. This will output the contract address that the smart contract was deployed to, beginning with <code>0x</code>.</li>
  <li>From <i>another</i> terminal, run <code>npx hardhat console --network localhost</code>.</li>
  <li>Now, you can interact with the contract. Try the following:</li>
</ol>

<pre><code>const CollateralizedLoan = await ethers.getContractFactory("CollateralizedLoan");
const contract = await CollateralizedLoan.attach("YOUR_DEPLOYED_CONTRACT_ADDRESS");
const accounts = await ethers.getSigners();

// Request a loan
await contract.connect(accounts[1]).depositCollateralAndRequestLoan(1, 60, { value: 3 });

// Fund a loan
await contract.connect(accounts[2]).fundLoan(0, { value: 3 });</code></pre>

To test the smart contract's functionality, you can run `npx hardhat test` from inside the cloned directory.