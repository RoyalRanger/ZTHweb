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
        activationAmountPlanck: '25000000000',
        description: "Miner contract for mining ZTH",
        name: "GrandPoolZTH",
        referencedTransactionHash: "",
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
            recipientId: Global.UserContract.at,
            feePlanck: "2000000"
        })
        const ConfirmResponse = await Global.wallet.confirm(UnsignedBytes.unsignedTransactionBytes)
        alert(`Transaction broadcasted! Id: ${ConfirmResponse.transactionId}. Balance will be added in 8 minutes.`);
    } catch (err) {
        alert(`Transaction failed.\n\n${err.message}`);
    }
}

async function evtChangeIntensity() {
    if (Global.walletResponse === null || Global.walletResponse === undefined) {
        alert("'Change intensity' is avaliable only using Signum XT Wallet.")
        return
    }
    const strIntensity = prompt("Enter the new intensity")
    let numberIntensity = Number(strIntensity)
    if (isNaN(numberIntensity)) {
        numberIntensity = Number(strIntensity.replace(',','.'))
    }
    if (isNaN(numberIntensity)) {
        return
    }
    if (numberIntensity < 0.32) {
        numberIntensity = 0.32
    }
    const strBalance = prompt("How much Signa?")
    let numberBalance = Number(strBalance)
    if (isNaN(numberBalance)) {
        numberBalance = Number(strBalance.replace(',','.'))
    }
    if (isNaN(numberBalance)) {
        return
    }
    if (numberBalance < 0.5) {
        numberBalance = 0.5;
    }
    if (!confirm(`You will change the mining intensity to ${numberIntensity} Signa and add ${numberBalance} Signa to the miner contract ${Global.UserContract.atRS}.`)) {
        return
    }
    
    try {
        const attachment = new sig$.AttachmentMessage({
            message: numberIntensity.toString(10),
            messageIsText: true
        });
        const amountPlanck = ((numberBalance) * 1E8).toFixed(0);
        const UnsignedBytes = await Global.signumJSAPI.transaction.sendAmountToSingleRecipient({
            amountPlanck,
            attachment,
            senderPublicKey: Global.walletResponse.publicKey,
            recipientId: Global.UserContract.at,
            feePlanck: "1000000"
        })
        const ConfirmResponse = await Global.wallet.confirm(UnsignedBytes.unsignedTransactionBytes)
        alert(`Transaction broadcasted! Id: ${ConfirmResponse.transactionId}. Transaction will be processed between 8 minutes and 1 hour.`);
    } catch (err) {
        alert(`Transaction failed.\n\n${err.message}`);
    }
}

async function evtStop() {
    if (Global.walletResponse === null || Global.walletResponse === undefined) {
        alert("'stop' is avaliable only using Signum XT Wallet.")
        return
    }
    if (!confirm(`You will order the miner contract ${Global.UserContract.atRS} to stop mining and send all balance back to you. This transaction costs 0.5 Signa.`)) {
        return
    }
    
    try {
        const attachment = new sig$.AttachmentMessage({
            message: 'stop',
            messageIsText: true
        });
        const amountPlanck = ((0.5) * 1E8).toFixed(0);
        const UnsignedBytes = await Global.signumJSAPI.transaction.sendAmountToSingleRecipient({
            amountPlanck,
            attachment,
            senderPublicKey: Global.walletResponse.publicKey,
            recipientId: Global.UserContract.at,
            feePlanck: "1000000"
        })
        const ConfirmResponse = await Global.wallet.confirm(UnsignedBytes.unsignedTransactionBytes)
        alert(`Transaction broadcasted! Id: ${ConfirmResponse.transactionId}. Refund can take up to one hour.`);
    } catch (err) {
        alert(`Transaction failed.\n\n${err.message}`);
    }
}

async function evtDeployMiner() {
    if (Global.walletResponse === null || Global.walletResponse === undefined) {
        alert("Deploy is avaliable only using Signum XT Wallet.")
        return
    }
    Config.MinerContractArgs.senderPublicKey = Global.walletResponse.publicKey
    try {
        const UnsignedResponse = await Global.signumJSAPI.contract.publishContractByReference(Config.MinerContractArgs)
        const DeployResponse = await Global.wallet.confirm(UnsignedResponse.unsignedTransactionBytes)
        alert(`Transaction broadcasted! Id: ${DeployResponse.transactionId}\n\nWait 8 minutes and reload the page.`);
    } catch (err) {
        alert('Failed:\n\n' + err.message)
    }
}

/** Populates:
 *  Global.wallet, Global.walletResponse, and localStorage */
async function activateWalletXT(silent) {
    if (Global.wallet !== undefined) {
        return;
    }
    Global.wallet = new sig$wallets.GenericExtensionWallet();
    try {
        Global.walletResponse = await Global.wallet.connect({
            appName: "ZTH Mining",
            networkName: "Signum"
       })
        Global.walletSubscription = Global.walletResponse.listen({
            onAccountChanged: (newVal) => {
                localStorage.setItem('userRS', idTOaccount(BigInt(newVal.accountId)));
                localStorage.setItem('userId', newVal.accountId);
                localStorage.setItem('userHasXT', 'true');
                Global.walletResponse.publicKey = newVal.accountPublicKey;
                updateLinkedAccount();
                updatePlayerDetailsAndContract();
            }
        })
        localStorage.setItem('userRS', idTOaccount(BigInt(Global.walletResponse.accountId)));
        localStorage.setItem('userId', Global.walletResponse.accountId);
        localStorage.setItem('userHasXT', 'true');
    } catch (err) {
        if (!silent) {
            alert("Signum XT Wallet error:\n\n" + err.message);
        } else {
            console.log("Silent conection to Wallet failed. Unlinking user.")
        }
        Global.walletResponse = undefined;
        Global.wallet = undefined;
        localStorage.removeItem('userHasXT');
        localStorage.removeItem('userRS');
        localStorage.removeItem('userId');
    }
}

async function evtLinkWithXT () {
    await activateWalletXT(false);
    updateLinkedAccount();
    updatePlayerDetailsAndContract();
}

function evtLinkAccount() {
    let userRS = document.getElementById('rsToLink').value.trim();
    let idExec = /^(BURST-|S-|TS-)([0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{5})/.exec(userRS)
    if (idExec === null) {
        alert("Error decoding RS-Address...");
        return;
    }
    let userId = rsDecode(idExec[2]);
    if (userId === '') {
        alert("Error decoding RS-Address...");
        return;
    }
    localStorage.setItem('userRS', userRS);
    localStorage.setItem('userId', userId.toString(10));
    updateLinkedAccount();
    updatePlayerDetailsAndContract();
}

function evtUnlinkAccount() {
    localStorage.removeItem('userRS');
    localStorage.removeItem('userId');
    localStorage.removeItem('userHasXT');
    Global.walletSubscription?.unlisten();
    Global.wallet = undefined;
    Global.walletResponse = undefined;
    document.getElementById('rsToLink').value = '';
    updateLinkedAccount();
    updatePlayerDetailsAndContract();
}

function getTMGFromUser(UserAccount) {
    if (UserAccount === undefined || UserAccount.assetBalances === undefined) {
        return 0
    }
    for (let i = 0; i< UserAccount.assetBalances.length; i++) {
        if (UserAccount.assetBalances[i].asset === Config.assetId) {
            return Number(UserAccount.assetBalances[i].balanceQNT)/10
        }
    }
    return 0
}

function getTMGFromUser_2(UserAccount) {
    if (UserAccount === undefined || UserAccount.assetBalances === undefined) {
        return 0
    }
    for (let i = 0; i< UserAccount.assetBalances.length; i++) {
        if (UserAccount.assetBalances[i].asset === Config.assetId_2) {
            return Number(UserAccount.assetBalances[i].balanceQNT)
        }
    }
    return 0
}

async function updatePlayerDetailsAndContract() {
    const currentUser = localStorage.getItem('userId')
    if (currentUser === null) {
        document.getElementById('contract_found').style.display = 'none'
        document.getElementById('contract_not_found').style.display = 'none'
        return
    }
    
    let UserAccount
    try {
        UserAccount = await Global.signumJSAPI.account.getAccount({ accountId: currentUser })
    } catch (err) {
        UserAccount = undefined
    }
    document.getElementById('player_name').innerText = UserAccount?.name ?? ''
    let tmgAssetQuantity = getTMGFromUser(UserAccount)
    document.getElementById('player_tmg_quantity').innerText = tmgAssetQuantity
    document.getElementById('player_tmg_quantity_2').innerText = tmgAssetQuantity

    let tmgAssetQuantity_2 = getTMGFromUser_2(UserAccount)
    document.getElementById('my_balance').innerText = tmgAssetQuantity_2

    let UserContract
    try {
        UserContract = await Global.signumJSAPI.contract.getContractsByAccount({
            accountId: currentUser,
            machineCodeHash: Config.authorisedCodeHash.toString(10)
        })
    } catch (err) {
        UserContract = undefined
    }
    
    
    if (UserContract?.ats.length > 0) {
        document.getElementById('contract_found').style.display = 'block'
        document.getElementById('contract_not_found').style.display = 'none'
        Global.UserContract = UserContract.ats[0]
        for (let i = 1; i < UserContract.ats.length; i++) {
            // find the contract with the highest balance
            if (BigInt(UserContract.ats[i].balanceNQT) > BigInt(Global.UserContract.balanceNQT)) {
                Global.UserContract = UserContract.ats[i]
            }
        }

        const Variables = decodeMemory(Global.UserContract.machineData);
        const currBalance = Number(Global.UserContract.balanceNQT)/100000000
        const intensity = Number(Variables.longs[18])/100000000
        let remainingHours = currBalance / intensity
        if (isNaN(remainingHours)) remainingHours = 0
        document.getElementById('my_contract_rs').innerText = Global.UserContract.atRS
        document.getElementById('my_contract_balance').innerText = currBalance.toFixed(2)
        document.getElementById('my_contract_intensity').innerText = intensity.toFixed(2)
        document.getElementById('my_contract_remaining').innerText = remainingHours.toFixed(0) + " hours (" + (remainingHours/24).toFixed(2) + " days)"
    } else {
        document.getElementById('contract_found').style.display = 'none'
        document.getElementById('contract_not_found').style.display = 'block'
    }

}

function updateLinkedAccount() {
    let userRS = localStorage.getItem('userRS');
    if (userRS === null) {
        const spans = document.getElementsByName("playerRS")
        spans.forEach( dom => {
            dom.innerText = ''
        })
        const divLinked = document.getElementsByName("linked")
        divLinked.forEach( dom => {
            dom.style.display='none'
        })
        const divUnlinked = document.getElementsByName("unlinked")
        divUnlinked.forEach( dom => {
            dom.style.display='block'
        })
    } else {
        const spans = document.getElementsByName("playerRS")
        spans.forEach( dom => {
            dom.innerText = userRS
        })
        const divLinked = document.getElementsByName("linked")
        divLinked.forEach( dom => {
            dom.style.display='block'
        })
        const divUnlinked = document.getElementsByName("unlinked")
        divUnlinked.forEach( dom => {
            dom.style.display='none'
        })
    }
}



function requestData() {
    Global.fetchingData = true;
    setTimeout(() => {
        if (Global.fetchingData === true) {
            chooseNewServer();
        }
    }, 5500);
    const xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            // Typical action to be performed when the document is ready:
            Global.fetchingData = false;
            processData(xhttp.responseText);
        }
    };
    xhttp.open("GET", `${Global.server}/burst?requestType=getATDetails&at=${Config.SmartContractId.toString(10)}`, true);
    xhttp.send();
}


function processData(json_text) {
    const contractInfo=JSON.parse(json_text);
    if (contractInfo.machineData === undefined) {
        chooseNewServer();
        return;
    }

    // Sucessfull connection with a node
    Global.signumJSAPI = sig$.composeApi({
        nodeHost: Global.server
    });

    localStorage.setItem("preferedNode", Global.server);
    document.getElementById("current_node").innerText = Global.server;

    const Variables = decodeMemory(contractInfo.machineData);

    Picker.tokenId = Variables.longs[12];

    Picker.currentTX.txId = Variables.longs[18]
    Picker.currentTX.baseDeadline = Variables.longs[19]
    Picker.currentTX.sender = Variables.longs[20]
    Picker.currentTX.miningIntensity = Variables.longs[21]

    Picker.best.deadline = Variables.longs[22]
    Picker.best.sender = Variables.longs[23]

    Picker.stats.overallMiningFactor = Variables.longs[24]
    Picker.stats.lastOverallMiningFactor = Variables.longs[25]
    Picker.stats.processedDeadlines = Variables.longs[26]
    Picker.stats.currentHeight = Variables.longs[27]
    Picker.stats.lastWinnerId = Variables.longs[28]
    Picker.stats.lastWinnerDeadline = Variables.longs[29]

    Picker.processTX.miningFactor = Variables.longs[30]
    Picker.processTX.currentDeadline = Variables.longs[31]
    Picker.forgeTokens.lastForging = Variables.longs[32]
    Picker.forgeTokens.currentBlock = Variables.longs[33]
    Picker.distributeBalance.currentAvailableBalance = Variables.longs[34]

    updatePickerDetails()
    updatePlayerDetailsAndContract()
}

function updatePickerDetails() {
    const bestDeadlineLog = Math.log2(Number(Picker.best.deadline)).toFixed(2)
    const lastWinnerDeadlineLog = Math.log2(Number(Picker.stats.lastWinnerDeadline)).toFixed(2)
    document.getElementById("current_height").innerText = Picker.stats.currentHeight
    if (Picker.best.sender === 0n) {
        document.getElementById("best_sender").innerText = 'None submitted'
    } else {
        document.getElementById("best_sender").innerText = idTOaccount(Picker.best.sender)
    }
    document.getElementById("best_deadline").innerText = bestDeadlineLog
    document.getElementById("last_mining_intensity").innerText = ((Number(Picker.stats.lastOverallMiningFactor)/100000000) * 0.32).toFixed(2)
    document.getElementById("last_winner_account").innerText = idTOaccount(Picker.stats.lastWinnerId)
    document.getElementById("last_winner_deadline").innerText = lastWinnerDeadlineLog
    document.getElementById("last_forging_blockheight").innerText = Picker.forgeTokens.lastForging
}

/* **** Function utils ******* */

function unsigned2signed(unsigned) {
    if (unsigned >= (1n << 63n)) {
        return unsigned - (1n << 64n);
    }
    return unsigned;
}

function chooseNewServer() {
    let message = `Server ${Global.server} is not responding. Select new one in "Options".`
    // document.getElementById("show_current_node").innerText = '';
    alert(message);
}

//input: entire MachineData
//output: Obj { strings, longs (BigInt) }
//Warning! Decodes text but not utf-8, only ascii!
function decodeMemory(hexstring){
    const retObj = {
        longs: [],
        strings: [],
    }
    for (let i=0; i< hexstring.length; i+=16) {
        let hexlong = hexstring.slice(i,i+16);
        let txt = "";
        let val = 0n;
        let mult = 1n;
        for (let j=0; j<16; j+=2) {
            let byte = parseInt(hexlong.slice(j, j + 2), 16)
            if (byte >= 32 && byte <= 126) {
                txt+=String.fromCharCode(byte);
            }
            val += mult*BigInt(byte);
            mult *= 256n;
        }
        retObj.strings.push(txt);
        retObj.longs.push(val);
    }
    return retObj;
}

//Input id in unsigned long (BigInt)
//Output string with account address (Reed-Salomon encoded)
function idTOaccount(id) {

    let gexp = [1, 2, 4, 8, 16, 5, 10, 20, 13, 26, 17, 7, 14, 28, 29, 31, 27, 19, 3, 6, 12, 24, 21, 15, 30, 25, 23, 11, 22, 9, 18, 1]
    let glog = [0, 0, 1, 18, 2, 5, 19, 11, 3, 29, 6, 27, 20, 8, 12, 23, 4, 10, 30, 17, 7, 22, 28, 26, 21, 25, 9, 16, 13, 14, 24, 15]
    let cwmap = [3, 2, 1, 0, 7, 6, 5, 4, 13, 14, 15, 16, 12, 8, 9, 10, 11]
    let alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ".split("")
    let base32alpha="0123456789abcdefghijklmnopqrstuv"
    let base32Length = 13
    let account = "S-"
    let i;
    
    function gmult(a, b) {
        if (a == 0 || b == 0) {
            return 0;
        }
        return gexp[ (glog[a] + glog[b]) % 31 ]
    }
    
    if (id == 0){
        return ""
    }
    
    const base32=id.toString(32).padStart(13,"0").split("")
    var codeword=[]
    for (i=0; i<base32Length; i++){
        codeword.push( base32alpha.indexOf(base32[12-i]) );
    }
    
    var p = [0, 0, 0, 0]
    for (i=base32Length-1; i>=0; i--) {
        let fb = codeword[i] ^ p[3]
        
        p[3] = p[2] ^ gmult(30, fb)
        p[2] = p[1] ^ gmult(6, fb)
        p[1] = p[0] ^ gmult(9, fb)
        p[0] = gmult(17, fb)
    }
    codeword.push(p[0], p[1], p[2], p[3])
    
    for (i=0; i<17; i++) {
        account+=alphabet[codeword[cwmap[i]]]
            if ((i & 3) == 3 && i < 13) {
                account+="-"
            }
    }
    
    return account
}

/* eslint-disable camelcase */
// Decode REED-SALOMON burst address from string to BigInt value
// Adapted from https://github.com/burst-apps-team/burstkit4j
function rsDecode(cypher_string) {
    const gexp = [1, 2, 4, 8, 16, 5, 10, 20, 13, 26, 17, 7, 14, 28, 29, 31, 27, 19, 3, 6, 12, 24, 21, 15, 30, 25, 23, 11, 22, 9, 18, 1];
    const glog = [0, 0, 1, 18, 2, 5, 19, 11, 3, 29, 6, 27, 20, 8, 12, 23, 4, 10, 30, 17, 7, 22, 28, 26, 21, 25, 9, 16, 13, 14, 24, 15];
    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const codeword_map = [3, 2, 1, 0, 7, 6, 5, 4, 13, 14, 15, 16, 12, 8, 9, 10, 11];
    function gmult(a, b) {
        if (a === 0 || b === 0) {
            return 0;
        }
        const idx = (glog[a] + glog[b]) % 31;
        return gexp[idx];
    }
    function is_codeword_valid(codeword) {
        let sum = 0;
        let i, j, t, pos;
        for (i = 1; i < 5; i++) {
            t = 0;
            for (j = 0; j < 31; j++) {
                if (j > 12 && j < 27) {
                    continue;
                }
                pos = j;
                if (j > 26) {
                    pos -= 14;
                }
                t ^= gmult(codeword[pos], gexp[(i * j) % 31]);
            }
            sum |= t;
        }
        return sum === 0;
    }
    let codeword_length = 0;
    const codeword = [];
    let codework_index;
    for (let i = 0; i < cypher_string.length; i++) {
        const position_in_alphabet = alphabet.indexOf(cypher_string.charAt(i));
        if (position_in_alphabet <= -1) {
            continue;
        }
        codework_index = codeword_map[codeword_length];
        codeword[codework_index] = position_in_alphabet;
        codeword_length++;
    }
    if (codeword_length !== 17 || !is_codeword_valid(codeword)) {
        return '';
    }
    // base32 to base10 conversion
    const length = 13;
    let val = 0n;
    let mul = 1n;
    for (let i = 0; i < length; i++) {
        val += mul * BigInt(codeword[i]);
        mul *= 32n;
    }
    return val;
}
