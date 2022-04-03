import React, { useState } from "react";
import { Buffer } from "buffer";
import algosdk from "algosdk";
import approval from "./contracts/approval";
import clear from "./contracts/clear";

const creatorMnemonic =
	"panda upset appear excess senior sunny dash pluck sand essence knife receive better category cloud bar purchase duck favorite illness still hope thing able acid";
const userMnemonic =
	"remain buzz merge spend cradle urban front asset mail noble frown intact pear time family please disorder staff zone print alley answer almost about fog";

// user declared algod connection parameters
const algodAddress = "http://localhost:4001";
const algodServer = "http://localhost";
const algodPort = 4001;
const algodToken = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

// declare application state storage (immutable)
const localInts = 1;
const localBytes = 1;
const globalInts = 1;
const globalBytes = 1;

// user declared approval program (refactored)
let approvalProgramSourceRefactored = approval;

// declare clear state program source
let clearProgramSource = clear;

let algodClient;
let creatorAccount;
let userAccount;
let approvalProgram;
let clearProgram;
let appId;
let appInc = [];
let appDec = [];

function App() {
	const [counter, setCounter] = useState([0]);

	// helper function to compile program source
	async function compileProgram(client, programSource) {
		let encoder = new TextEncoder();
		let programBytes = encoder.encode(programSource);
		let compileResponse = await client.compile(programBytes).do();
		let compiledBytes = new Uint8Array(Buffer.from(compileResponse.result, "base64"));
		return compiledBytes;
	}

	// helper function to await transaction confirmation
	// Function used to wait for a tx confirmation
	const waitForConfirmation = async function (algodclient, txId) {
		let status = await algodclient.status().do();
		let lastRound = status["last-round"];
		while (true) {
			const pendingInfo = await algodclient.pendingTransactionInformation(txId).do();
			if (pendingInfo["confirmed-round"] !== null && pendingInfo["confirmed-round"] > 0) {
				//Got the completed Transaction
				console.log("Transaction " + txId + " confirmed in round " + pendingInfo["confirmed-round"]);
				break;
			}
			lastRound++;
			await algodclient.statusAfterBlock(lastRound).do();
		}
	};

	// create new application
	async function createApp(client, creatorAccount, approvalProgram, clearProgram, localInts, localBytes, globalInts, globalBytes) {
		// define sender as creator
		let sender = creatorAccount.addr;
		// declare onComplete as NoOp
		let onComplete = algosdk.OnApplicationComplete.NoOpOC;

		// get node suggested parameters
		let params = await client.getTransactionParams().do();
		// comment out the next two lines to use suggested fee
		params.fee = 1000;
		params.flatFee = true;

		// create unsigned transaction
		let txn = algosdk.makeApplicationCreateTxn(sender, params, onComplete, approvalProgram, clearProgram, localInts, localBytes, globalInts, globalBytes);
		let txId = txn.txID().toString();

		// Sign the transaction
		let signedTxn = txn.signTxn(creatorAccount.sk);
		console.log("Signed transaction with txID: %s", txId);

		// Submit the transaction
		await client.sendRawTransaction(signedTxn).do();
		// Wait for confirmation
		await waitForConfirmation(client, txId);

		// display results
		let transactionResponse = await client.pendingTransactionInformation(txId).do();
		let appId = transactionResponse["application-index"];
		console.log("Created new app-id: ", appId);
		return appId;
	}

	// call application
	async function callApp(client, account, index, appArgs) {
		// define sender
		let sender = account.addr;

		// get node suggested parameters
		let params = await client.getTransactionParams().do();
		// comment out the next two lines to use suggested fee
		params.fee = 1000;
		params.flatFee = true;

		// create unsigned transaction
		let txn = algosdk.makeApplicationNoOpTxn(sender, params, index, appArgs);
		let txId = txn.txID().toString();

		// Sign the transaction
		let signedTxn = txn.signTxn(account.sk);
		console.log("Signed transaction with txID: %s", txId);

		// Submit the transaction
		await client.sendRawTransaction(signedTxn).do();

		// Wait for confirmation
		await waitForConfirmation(client, txId);

		// display results
		let transactionResponse = await client.pendingTransactionInformation(txId).do();
		console.log("Called app-id:", transactionResponse["txn"]["txn"]["apid"]);
		if (transactionResponse["global-state-delta"] !== undefined) {
			console.log("Global State updated:", transactionResponse["global-state-delta"]);
			setCounter(transactionResponse["global-state-delta"]);
		}
		if (transactionResponse["local-state-delta"] !== undefined) {
			console.log("Local State updated:", transactionResponse["local-state-delta"]);
		}
	}

	// read global state of application
	async function readGlobalState(client, account, index) {
		let accountInfoResponse = await client.accountInformation(account.addr).do();
		for (let i = 0; i < accountInfoResponse["created-apps"].length; i++) {
			if (accountInfoResponse["created-apps"][i].id === index) {
				console.log("Application's global state:");
				for (let n = 0; n < accountInfoResponse["created-apps"][i]["params"]["global-state"].length; n++) {
					console.log(accountInfoResponse["created-apps"][i]["params"]["global-state"][n]);
				}
			}
		}
	}

	async function deleteApp(client, creatorAccount, index) {
		// define sender as creator
		let sender = creatorAccount.addr;

		// get node suggested parameters
		let params = await client.getTransactionParams().do();
		// comment out the next two lines to use suggested fee
		params.fee = 1000;
		params.flatFee = true;

		// create unsigned transaction
		let txn = algosdk.makeApplicationDeleteTxn(sender, params, index);
		let txId = txn.txID().toString();

		// Sign the transaction
		let signedTxn = txn.signTxn(creatorAccount.sk);
		console.log("Signed transaction with txID: %s", txId);

		// Submit the transaction
		await client.sendRawTransaction(signedTxn).do();

		// Wait for confirmation
		await waitForConfirmation(client, txId);

		// display results
		let transactionResponse = await client.pendingTransactionInformation(txId).do();
		let appId = transactionResponse["txn"]["txn"].apid;
		console.log("Deleted app-id: ", appId);
		return appId;
	}

	async function createApplication() {
		try {
			// initialize an algodClient
			algodClient = new algosdk.Algodv2(algodToken, algodServer, algodPort);

			// get accounts from mnemonic
			creatorAccount = algosdk.mnemonicToSecretKey(creatorMnemonic);
			userAccount = algosdk.mnemonicToSecretKey(userMnemonic);

			// compile programs
			approvalProgram = await compileProgram(algodClient, approvalProgramSourceRefactored);
			clearProgram = await compileProgram(algodClient, clearProgramSource);

			// create new application
			appId = await createApp(algodClient, creatorAccount, approvalProgram, clearProgram, localInts, localBytes, globalInts, globalBytes);
		} catch (err) {
			console.log("err", err);
		}
	}

	async function increment() {
		appInc.push(new Uint8Array(Buffer.from("add"))); //Replace add with minus to subtract.. MUST ADD FIRST, cant have negative number
		await callApp(algodClient, userAccount, appId, appInc);
		await readGlobalState(algodClient, userAccount, appId);
	}

	async function decrement() {
		appDec.push(new Uint8Array(Buffer.from("minus"))); //Replace add with minus to subtract.. MUST ADD FIRST, cant have negative number
		await callApp(algodClient, userAccount, appId, appDec);
		await readGlobalState(algodClient, userAccount, appId);
	}

	async function endApplication() {
		await deleteApp(algodClient, creatorAccount, appId);
		setCounter([0]);
	}

	function getCount() {
		alert("The current count is" + JSON.stringify(counter));
	}

	return (
		<div className="App">
			<div className="container">
				<h1>Algorand Counter Application</h1>
				<div className="text">{counter.map((count, index) => JSON.stringify(count.value))}</div>
				<button className="btn" onClick={() => createApplication()}>
					Create Application
				</button>
				<button className="btn" onClick={() => decrement()}>
					Decrement
				</button>
				<button className="btn" onClick={() => getCount()}>
					{" "}
					Count
				</button>
				<button className="btn" onClick={() => increment()}>
					Increment
				</button>
				<button className="btn" onClick={() => endApplication()}>
					End Application
				</button>
			</div>
		</div>
	);
}

export default App;
