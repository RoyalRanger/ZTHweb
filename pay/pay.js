"use strict";

const Config = {
    defaultServer: 'https://europe.signum.network',
    SmartContractId: 738377637144987047n,
    authorisedCodeHash: 13623170965212595266n,
    assetId: "9518219425200752102", 
    assetId_2: "9381200141252723234",
    serverAlternatives: [
        "https://brazil.signum.network",
        "https://uk.signum.network",
        "https://cryptodefrag.com:8125",
        "https://europe.signum.network",
        "https://australia.signum.network",
        "https://signawallet.notallmine.net"
    ],
    MinerContractArgs: {
        feePlanck: '20000000',
        activationAmountPlanck: '15000000000',
        description: "This A1 smart contract issues and sells a VGB token. This is a virtual HDD token for mining Zethereum #ZTH",
        name: "ZStoreVGB",
        referencedTransactionHash: "TokenSellerContractContext.ReferenceHash.Mainnet",
    }
}

const Picker = {
    tokenId: 0n,
    currentTX: {
        txId: 0n,
        baseDeadline: 0n,
        sender: 0n,
        miningIntensity: 0n,
    },
    best: {
        deadline: 0n,
        sender: 0n,
    },
    stats: {
        overallMiningFactor: 0n,
        lastOverallMiningFactor: 0n,
        processedDeadlines: 0n,
        currentHeight: 0n,
        lastWinnerId: 0n,
        lastWinnerDeadline: 0n,
    },
    processTX: {
        miningFactor: 0n,
        currentDeadline: 0n,
    },
    forgeTokens: {
        lastForging: 0n,
        currentBlock: 0n,
    },
    distributeBalance: {
        currentAvailableBalance: 0n,
    }
}

const Global = {
    server: '',
    fetchingData: false,
    signumJSAPI: undefined,
    wallet: undefined,
    walletResponse: undefined,
    walletSubscription: undefined,
    UserContract: undefined
}

window.onload = function () {
    let preferedNode = localStorage.getItem("preferedNode");
    if (preferedNode === null) {
        Global.server = Config.defaultServer;
    } else {
        Global.server = preferedNode;
    }
    
    // document.getElementById("show_current_node").innerText = Global.server;
    // document.getElementById("node_list").innerHTML = Config.serverAlternatives.join("<br>");

    Config.SmartContractRS = idTOaccount(Config.SmartContractId);
    requestData();

    document.getElementById("btn_link_account").addEventListener('click',evtLinkAccount);
    document.getElementById("btn_unlink_account").addEventListener('click',evtUnlinkAccount);
    document.getElementById("btn_deploy_miner").addEventListener('click',evtDeployMiner);
    document.getElementById("btn_link_with_xt").addEventListener('click',evtLinkWithXT);
    document.getElementById("btn_add_balance").addEventListener('click',evtAddBalance);
    document.getElementById("btn_change_intensity").addEventListener('click',evtChangeIntensity);
    document.getElementById("btn_stop").addEventListener('click',evtStop);
    document.getElementById("btn_new_node").addEventListener('click',evtNewNode);
    
    const spans = document.getElementsByName("scid");
    spans.forEach( dom => {
        dom.innerText = Config.SmartContractRS;
    })

    document.getElementById("nodes_list").innerHTML = Config.serverAlternatives.join('<br>')

    // Update user detail
    if (localStorage.getItem('userHasXT') === 'true') {
        //try to link using XT silently
        activateWalletXT(true).then((resp) => {
            updateLinkedAccount()
        });
    } else {
        updateLinkedAccount()
    }    
}

function evtNewNode() {
    let newNode = document.getElementById("ipt_new_node").value
    if (!newNode.startsWith('http')) {
        newNode = 'https://' + newNode
    }
    localStorage.setItem("preferedNode", newNode)
    location.reload()
}

async function evtAddBalance() {
    if (Global.walletResponse === null || Global.walletResponse === undefined) {
        alert("'Add balance' is avaliable only using Signum XT Wallet.")
        return
    }
    const strBalance = prompt("Введите сумму в SIGNA из рассчтета 1 виртуальный VGB = 250 SIGNA")
    let numberBalance = Number(strBalance)
    if (isNaN(numberBalance)) {
        numberBalance = Number(strBalance.replace(',','.'))
    }
    if (isNaN(numberBalance) || numberBalance < 0.5) {
        return
    }
    if (!confirm(`Вы отправляете ${numberBalance} Signa на контракт ${Global.UserContract.atRS}.`)) {
        return
    }

    try {
        const amountPlanck = ((numberBalance) * 1E8).toFixed(0);
        const UnsignedBytes = await Global.signumJSAPI.transaction.sendAmountToSingleRecipient({
            amountPlanck,
            senderPublicKey: Global.walletResponse.publicKey,
            recipientId: Global.UserContract.atRS,
            feePlanck: "2000000"
        })
        const ConfirmResponse = await Global.wallet.confirm(UnsignedBytes.unsignedTransactionBytes)
        alert(`Transaction broadcasted! Id: ${ConfirmResponse.transactionId}. Balance will be added in 8 minutes.`);
    } catch (err) {
        alert(`Transaction failed.\n\n${err.message}`);
    }
}

window.addEventListener('wallet-event', (event) => {
    const {payload, action} = event.detail

    if (action === 'connected') {
      document.querySelector('#account-connection span').innerText = payload.address
      const avatar = document.querySelector('#account-connection img')
      avatar.src = window.hashicon(payload.accountId, 64).toDataURL()
      document.getElementById('successful-connection').classList.remove("is-hidden")
      document.getElementById('network').innerText = payload.host;
    }

    if (action === 'disconnected') {
      document.getElementById('successful-connection').classList.add("is-hidden")
      document.getElementById('connect-button-text').innerText = 'Connect Wallet'
      document.querySelector('#connect-button-icon span').classList.remove('is-hidden');
      const avatar = document.querySelector('#connect-button-icon img')
      avatar.src = ""
      avatar.classList.add('is-hidden');
    }

    if (action === 'accountChanged') {
      document.querySelector('#account-connection span').innerText = payload.address
      const avatar = document.querySelector('#account-connection img')
      avatar.src = window.hashicon(payload.accountId, 64).toDataURL()
    }

    if (action === 'networkChanged') {
      document.getElementById('network').innerText = payload.nodeHost;
    }

  })
}

async function sendTestMessage() {
  try {

    if (!window.signumLedger) {
      throw new Error("Ledger Client not initialized");
    }

    const link = document.getElementById('transaction-link')
    link.classList.add('is-hidden')
    const {unsignedTransactionBytes} = await window.signumLedger.message.sendMessage({
      senderPublicKey: walletConnection.publicKey,
      recipient: walletConnection.accountId, // send to self
      message: "If you can read this message, then you successfully sent the message with XT Vanilla Demo App",
      messageIsText: true,
      feePlanck: sig$util.Amount.fromSigna('0.01').getPlanck()
    })
    const tx = await window.wallet.confirm(unsignedTransactionBytes)
    link.classList.remove('is-hidden')
    link.setAttribute('href', `https://t-chain.signum.network/tx/${tx.transactionId}`)
  } catch (e) {
    alert(e.message)
  }
}
