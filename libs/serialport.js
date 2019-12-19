const serialport = require('serialport');
const RadialGauge = require('canvas-gauges');

var port;
var output;

var states = ['Initialization', 'Self Check', 'BPS Power', 'BPS Ready', 'Array Ready', 'CAN Check', 'Precharge', 'Normal OP', 'Charge Mode', 'Error Mode'];

var voltList = [];
var tempList = [];
var minMaxList = {
    maxVolts: [],
    minVolts: [],
    maxTemps: [],
    minTemps: [],
}
var state;
var current;
var volts;
var error;

var requests = ['temps\r', 'volts\r', 'current\r', 'state\r', 'error\r'];

// get all serial ports and display them as buttons on to of screen
serialport.list((err, ports) => {
    if (err) {
        document.getElementById('error').textContent = err.message
        return
    } else {
        document.getElementById('error').textContent = ''
    }

    if (ports.length === 0) {
        document.getElementById('error').textContent = 'No ports discovered'
    }

    var portList = '';
    ports.forEach(port => {
        portList += makeButton(port.comName);
    });

    document.getElementById('ports').innerHTML = portList;

});

function setCom(com) {
    // clear the ports and show data
    document.getElementById('ports').style.display = 'none';
    document.getElementById('data-container').style.display = 'initial';

    // create new port object and start reading data
    port = new serialport(com, {baudRate: 38400}, handleError);
    readData();
    sendRequests();
}

// send new data request every 300 ms
// spread to allow data to finish sending before asking for the next one
function sendRequests() {
    setInterval(() => {
        toHTML();
        requests.forEach((r, index) => {
            setTimeout(() => {
                port.write(r, handleError);
            }, 300 * (index + 1))
        })
    }, 1500);
}

// create listener for serial data
function readData() {
    port.on('data', data => {
        if (data) {
            data.forEach(d => {
                // check for new line character
                if (d == 10) {
                    parseLine(output);
                    output = ''
                }
                else {
                    output += String.fromCharCode(d);
                }
            })
        }
    })
}

// create html button with com name
function makeButton(comName) {
    return '<button class="com-button" onclick="setCom(`'+comName+'`)">'+comName+'</button>';
}

// function for printing errors
function handleError(error) {
    if (error) {
        console.error(error.message);
    }
}

function parseLine(output) {
    if (output.indexOf("Cell") >= 0) {
        // voltage
        var index = parseInt(output.substring(6, 8));
        voltList[index] = parseFloat(output.substring(10, 15));
    }
    else if (output.indexOf("Temp") >= 0 && output.indexOf("Max") < 0) {
        // temperature
        var index = parseInt(output.substring(6, 8));
        tempList[index] = parseFloat(output.substring(10, 15));
    }
    else if (output.indexOf("Battery State =") >= 0) {
        // find state and turn it into string
        state = output.substring(17, 18);
        state += ' - ' + states[parseInt(state) - 1];
        document.getElementById("state").innerText = state;
    }
    else if (output.indexOf("Battery Current =") >= 0) {
        // battery current
        current = output.substring(19, 24);
        document.getElementById('current').setAttribute('data-value', parseFloat(current));

    }
    else if (output.indexOf("Battery =") >= 0) {
        // whole battery voltage
        battery = output.substring(10, 16);
        document.getElementById('batt-volts').setAttribute('data-value', parseFloat(battery));
    }
    else if (output.indexOf("Error: ") >= 0) {
        // errors
        error = output.substring(7);
        document.getElementById("battery-error").innerHTML = '<span class="batt-error">Error: <span class="error">' + error + '</span></span>';
    }
}

// find and save min and max values
function getMinMax() {
    // use spread for arrays to work
    maxVolts = Math.max(...voltList);
    minVolts = Math.min(...voltList);
    maxTemps = Math.max(...tempList);

    // save array of indexes in object
    minMaxList.maxVolts = getAll(maxVolts, voltList);
    minMaxList.minVolts = getAll(minVolts, voltList);
    minMaxList.maxTemps = getAll(maxTemps, tempList);

    // set html tag values
    document.getElementById('volt-max').innerText = maxVolts;
    document.getElementById('volt-min').innerText = minVolts;
    document.getElementById('volt-diff').innerText = (maxVolts- minVolts).toFixed(4);
}

// find all occurrences of value in array
function getAll(value, list) {
    return list.map((v, i) => v == value ? i : -1).filter(x => x != -1);
}

// get saved data and update html
function toHTML() {

    // get min max values
    getMinMax();

    // create empty two dimensional tables
    voltTable = [[]];
    tempTable =[[]];

    for(var i = 0; i < 35; i++) {

        // add new column if one does not exist
        if (!voltTable[Math.floor(i/5)]) {
            voltTable.push([]);
        }
        if (!tempTable[Math.floor(i/5)]) {
            tempTable.push([]);
        }

        // fill tables with values
        // snake up and down columns just like batteries
        if ((i % 10) < 5) {
            voltTable[Math.floor(i/5)][4-(i%5)] = {i, value: voltList[i]};
            tempTable[Math.floor(i/5)][4-(i%5)] = {i, value: tempList[i]};
        }
        else {
            voltTable[Math.floor(i/5)][i%5] = {i, value: voltList[i]};
            tempTable[Math.floor(i/5)][i%5] = {i, value: tempList[i]};
        }
    }

    // get and clear tables
    var volts = document.getElementById('volts');
    var temps = document.getElementById('temps');
    volts.innerHTML = '';
    temps.innerHTML = '';

    for(var i = 0; i < 5; i++) {
        for(var j = 0; j < 7; j++) {
            // add div to volt table
            voltNumber = document.createElement('span', );
            voltNumber.innerText = voltTable[j][i].i + 1;
            cellVolt = document.createElement('div');
            cellVolt.innerText = voltTable[j][i].value;
            cellVolt.appendChild(voltNumber);
            if (minMaxList.maxVolts.includes(voltTable[j][i].i)) {
                cellVolt.classList.add('warning');
            }
            if (minMaxList.minVolts.includes(voltTable[j][i].i)) {
                cellVolt.classList.add('danger');
            }
            volts.appendChild(cellVolt)

            // add div to temp table
            tempNumber = document.createElement('span', );
            tempNumber.innerText = voltTable[j][i].i + 1;
            cellTemp = document.createElement('div');
            cellTemp.innerText = tempTable[j][i].value;
            cellTemp.appendChild(tempNumber);
            if (minMaxList.maxTemps.includes(tempTable[j][i].i)) {
                cellTemp.classList.add('danger');
            }
            temps.appendChild(cellTemp)
        }
    }
}

// open help collapse panel
// using max height for transition
function openHelp(id) {
    var content = document.getElementById(id);
    if (content.style.maxHeight) {
        content.style.maxHeight = null;
    }
    else {
        content.style.maxHeight = content.scrollHeight;
    }
}