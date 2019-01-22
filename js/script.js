var app = new Vue({
	el: "#app",
	data: {
		current: 		"commercium",
		currentFiat: 	"USD",
		msg: 			{ title: "", status: "positive", reason: "" },
		currencies: 	{ USD: "$", CAD: "$", CNY: "¥", EUR: "€", GBP: "£", JPY: "¥" },

		CMM:    		"commercium",
		commercium: 	{ address: "", pkey: "", insight: "https://explorer.commercium.net/",
						  amount: 0, price: 0, symbol: "CMM", tx: [], fee: 0.0002 }
	},
	methods: {
		init: function () {
			var pa = createNewAddress();
			this[this.current].address = pa[1].toString();
			this[this.current].pkey = pa[0].toString();
		},
		copyAddress: function () {
			var input = document.createElement('input');
			input.setAttribute("id", "address");
			input.setAttribute("class", "hidden");
			input.setAttribute("value", this.address);
			document.body.appendChild(input);

			// copy address
			document.getElementById('address').select();
			document.execCommand('copy');

			// remove element
			input.remove();
		},
		updateFiat: function (code) {
			app.currentFiat = code;
			app.updatePrices();
		},
		updatePrices: function () {
			var btcfiat;
			var btc;
			return $.get("https://min-api.cryptocompare.com/data/pricemulti?fsyms=BTC&tsyms=" + app.currentFiat).done(function(res) {
				try{
					btcfiat = res['BTC'][app.currentFiat];
				}
				catch(err){
			
				}
			}).then($.get("https://api.crex24.com/CryptoExchangeService/BotPublic/ReturnTicker?request=[NamePairs=BTC_CMM]").done(function(res) {
				try{
					btc = res["Tickers"][0]["Last"];
					var price = (btcfiat * btc);
					if(price > 0){
						app[app.current].price = price;
					}
				}
				catch(err){
					
				}
			}));
		},
		updateData: function () {
			if (app.address != "") {
				app.updatePrices().then(app.updateTransactions);
			}
		},
		getOutputValue: function (vouts) {
			for (var i = 0; i < vouts.length; i++) {
				if (vouts[i].scriptPubKey.addresses[0] == this[this.current].address) {
					return vouts[i].value;
				}
			}
		},
		getOutputValue2: function (vouts) {
			for (var i = 0; i < vouts.length; i++) {
				if (vouts[i].scriptPubKey.addresses[0] != this[this.current].address) {
					return vouts[i].value;
				}
			}
		},
		updateTransactions: function () {
			return $.ajax({
		        type: "get",
		        url: app.baseURL + "api/addr/" + app.address,
		        success: function (res) {
		            if (app[app.current].amount != res['balance']) {
						document.getElementById('audio').play();
					}
					app[app.current].amount = res['balance'];
		            $.ajax({
		                type: "get",
		                url: app.baseURL + "api/txs/?address=" + app.address,
		                success: function (data) {
							app[app.current].tx = data['txs'] ? data['txs'] : [];

							for (var i = 0; i < app[app.current].tx.length; i++) { 
								if (app[app.current].tx[i].vin.length == 0) {
									var data = { 'addr': 'zaddr' };
									app[app.current].tx[i].vin.push(data);
								}
							}
		                }
		            });
		        }
		    });
		},
		maxAmount: function () {
			if (this[this.current].amount > this[this.current].fee) {
				$('#send-amount')[0].value = (this[this.current].amount - this[this.current].fee).toFixed(8);
			} else {
				this.msg.status = "negative";
				this.msg.title = "Not enough coins in wallet";
				this.msg.reason = "Try sending some more coins to this wallet";
			}
		},
		sendTransaction: function () {
			var value = parseFloat($('#send-amount')[0].value);
			var fee = app[app.current].fee;
			var recipientAddress = $('#receive-address')[0].value;
			var senderAddress = app[app.current].address;

			// Convert how much we wanna send
			// to satoshis
			var satoshisToSend = Math.round(value * 100000000);
			var satoshisfeesToSend = Math.round(fee * 100000000);

			// Get previous transactions
			var prevTxURL = app[app.current].insight + 'api/addr/' + senderAddress + '/utxo';
			var infoURL = app[app.current].insight + 'api/status?q=getInfo';
			var sendRawTxURL = app[app.current].insight + 'api/tx/send';

			// Building our transaction TXOBJ
			// How many satoshis do we have so far
			var satoshisSoFar = 0;
			var history = [];
			var recipients = [{ address: recipientAddress, satoshis: satoshisToSend }];
			var txHexString;
			// Get transactions and info
			_axios2.default.get(prevTxURL).then(function (tx_resp) {
				var tx_data = tx_resp.data;
				//tx_data.sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount));
		
				_axios2.default.get(infoURL).then(function (info_resp) {
					var info_data = info_resp.data;
		
					var blockHeight = info_data.info.blocks - 300;
					var blockHashURL = app[app.current].insight + 'api/block-index/' + blockHeight;
		
					// Get block hash
					_axios2.default.get(blockHashURL).then(function (response_bhash) {
						var blockHash = response_bhash.data.blockHash;
						var senderPrivateKey;
						var transaction;
						var tx;
		
						tx = new bul.TransactionBuilder(bul.networks.commercium, satoshisfeesToSend);
						tx.setVersion(4);
						tx.setVersionGroupId(0x892F2085);
						tx.setExpiryHeight(blockHeight + 1452);
	
						if (recipientAddress.length !== 34) {
							this.msg.status = "negative";
							this.msg.title = "Error";
							this.msg.reason = "Incorrect address!";
	
							return;						
						}
		
						// Iterate through each utxo
						// append it to history
						for (var i = 0; i < tx_data.length; i++) {
							if (tx_data[i].confirmations == 0) {
								continue;
							}
							
							history = history.concat({
								txid: tx_data[i].txid,
								vout: tx_data[i].vout,
								scriptPubKey: tx_data[i].scriptPubKey,
								satoshis: tx_data[i].satoshis
							});
						
							// How many satoshis do we have so far
							satoshisSoFar = satoshisSoFar + tx_data[i].satoshis;
							if (satoshisSoFar >= satoshisToSend + satoshisfeesToSend) {
								break;
							} 
						}
	
						// If we don't have enough address
						// fail and tell user
						if (satoshisSoFar < satoshisToSend + satoshisfeesToSend) {
							this.msg.status = "negative";
							this.msg.title = "Error";
							this.msg.reason = "Not enough confirmed inputs to perform transaction!";
							return;
						}
	
						history.forEach(function(t) {
							tx.addInput(t.txid, t.vout);
						});
	
						// If we don't have exact amount
						// Refund remaining to current address
						if (satoshisSoFar !== satoshisToSend + satoshisfeesToSend) {
							var refundSatoshis = satoshisSoFar - satoshisToSend - satoshisfeesToSend;
			
							// Only refund satoshis if its > 60 (otherwise will be left unconfirmed)
							if (refundSatoshis > 60) {
								tx.addOutput(app[app.current].address, refundSatoshis);
							}
						}
						tx.addOutput(recipientAddress, satoshisToSend);
	
						var pair = bul.ECPair.fromWIF(app[app.current].pkey, bul.networks.commercium);	
						var sig = bul.Transaction.SIGHASH_ALL;
	
						for (u = 0; u < tx.inputs.length; u++) {
							tx.sign(u, pair, null, sig, history[u].satoshis);
						}
	
						txHexString = tx.build().toHex();
						_axios2.default.post(sendRawTxURL, { rawtx: txHexString }).then(function (sendtx_resp) {
							//DEBUG
							console.log(sendtx_resp.data.txid);
							window.location.reload();
							//this.setProgressValue(100);
						}.bind(this)).catch(function (error) {
							//this.setSendErrorMessage(error + '');
							console.log(error + '');
							//this.setProgressValue(0);
							this.msg.status = "negative";
							this.msg.title = "Error";
							this.msg.reason = "Try sending transaction again!";
							return;
						}.bind(this));
					}.bind(this));
				}.bind(this));
			}.bind(this)).catch(function (error) {
				//this.setSendErrorMessage(error);
				console.log(error);
				//this.setProgressValue(0);
				return;
			}.bind(this));
		}
	},   
	computed: {
    	address: function () {
			return this[this.current].address;
		},
    	private: function () {
			return this[this.current].pkey;
	    },
        amount: function () {
			return this[this.current].amount + " " + this[this.current].symbol;
	    },
	    baseURL: function () {
	    	return this[this.current].insight;
	    },
	    color: function () {
			return "grey";
		},
	    fee: function () {
			return this[this.current].fee;
	    },
    	fiat_amount: function () {
			return this.currencies[this.currentFiat] + (this[this.current].amount * this[this.current].price).toFixed(2) + " " + this.currentFiat;
	    },
	    symbol: function () {
	    	return this[this.current].symbol;
	    },
	    transactions: function () {
	    	return this[this.current].tx;
	    }
    }
})

function createNewAddress() {
	var phrase;
	if (getCookie('phrase').length == 0) {
		var mnem = makeMnemonic();
		phrase = new _buffer(prompt("Your wallet is generated completely client side and uses Commerciums Insight Explorer to send and receive funds. If this is your first visit please feel free to use the generated phrase or if you already have a phrase just enter it below and hit OK. Lose your phrase, lose your funds! If you dont agree to this please hit Cancel!", mnem));
		setCookie('phrase', phrase);
	}
	else {
		phrase = new _buffer(getCookie('phrase'));
	}

	const hash = bch.crypto.Hash.sha256(phrase);
	const bn = bch.crypto.BN.fromBuffer(hash);
	const address = new bch.PrivateKey(bn).toAddress();
	const pkey = new bch.PrivateKey(bn).toWIF();

	//DEBUG
	//console.log(address.toString());
	//console.log(pkey.toString());
	return [pkey, address];
}

function sendModal() {
	$('#send_modal').modal('show');
}

function privModal() {
	$('#priv_modal').modal('show');
}

$(document).ready(function() {
	app.init();
	app.updateData();
	$('.ui.dropdown').dropdown();
	setInterval(app.updateData, 30 * 1000);
});

function setCookie(cname, cvalue) {
    document.cookie = cname + '=' + cvalue + ';expires=Fri, 31 Dec 9999 23:59:59 GMT ;path=/';
}

function delCookie(cname) {
	var cvalue = getCookie(cname);
	if (cvalue.length > 0) {
		document.cookie = cname + '=' + cvalue + ';expires=Thu, 1 Jan 1970 23:59:59 GMT ;path=/';
		window.location.reload();
		console.log('done');
	}
}

function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for(var i = 0; i <ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

