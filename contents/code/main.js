
var layout = new LinearLayout(plasmoid);

// display CPU temperature
var cpuTempLabel = new Label();
layout.addItem(cpuTempLabel);
cpuTempLabel.text = "";

// display GPU temperature
var gpuTempLabel = new Label();
layout.addItem(gpuTempLabel);
gpuTempLabel.text = '';

var hddTempLabel = new Label();
layout.addItem(hddTempLabel);
hddTempLabel.text = '';

var timeDataEngine = dataEngine("time");
var smDataEngine = dataEngine("systemmonitor");

var tmpFileParentDir = "";
// information read from file net.ubuntudaily.hwmon.gpu.temp
gpuTempData = "";
hddTempData = "";


/**
 * 
 */
var config = {
    isTraceEnabled : true,
    // unit is millisecond
    updatePeriod : 3000
}

plasmoid.dataUpdated = function(name, data)
{
  
    trace("data source name :" + name);
    if(name == "UTC"){
        var output = {};
        
        // when the instance of plasmoid runs at the first time, tmpFileParentDir is empty, so we start to initialize it.
        if(tmpFileParentDir.length == 0){
            
            runShellCmd("id -u", output, function(){
                var id = output.str.trim();
                if(id){
                    tmpFileParentDir="/run/user/" + id;
                }
            });
        }
        
        // when the instance of plasmoid runs at the first time, the preceding runShellCmd codes are trying to 
        // initialize global tmpFileParentDir variable but not finished yet, so normally, the following codes 
        // will write temporary files to /tmp directory
        if(!updateGPUTemp.updating){
           
           updateGPUTemp();
        }  
        
        var gpuOutput = {};
        //this is wierd, why sometimes read blank while running this code block?
//         if(!runShellCmd.processing){
//             runShellCmd("nvidia-smi -q  -d TEMPERATURE|grep Gpu|cut -d: -f2", gpuOutput, function(){print("runShellCmd:"+gpuOutput.str);runShellCmd.processing=false;});
//         }
        
        //!updateHDDTemp.updating
        if(false){
            updateHDDTemp();
        }
    }else{
        
        if(data["name"] != undefined && data["name"].indexOf("temperature") != -1){
            
            cpuTempLabel.text = '<font color="yellow">' + 'C' + data["value"] + '</font>';;
        }
        //trace(ObjtoStr(data));
        trace("CPU Temp:" + data["value"]);

    }
    
}

 

 
function obj2Str(data) {
    var msg="";
    for (var elt in data) {
        msg += elt + ":";
        msg += data[elt] + ";";
    }
    return msg;
}
 
 

smDataEngine.connectSource("acpi/Thermal_Zone/0/Temperature", plasmoid, config.updatePeriod);
smDataEngine.sourceRemoved.connect(slotSysMonSourceRemoved);
smDataEngine.sourceAdded.connect(slotSysMonSourceAdded);

timeDataEngine.connectSource("UTC", plasmoid, config.updatePeriod);

plasmoid.configChanged = function()
{
    plasmoid.activeConfig = "main";
    var updatePeriod = plasmoid.readConfig("updatePeriod");
    config.updatePeriod = updatePeriod * 1000;
    reconnectDataSources(config.updatePeriod);
    trace("updatePeriod changed: " + config.updatePeriod);
}



function reconnectDataSources(updatePeriod){
    smDataEngine.disconnectSource("acpi/Thermal_Zone/0/Temperature", plasmoid);
    timeDataEngine.disconnectSource("UTC", plasmoid);
    
    smDataEngine.connectSource("acpi/Thermal_Zone/0/Temperature", plasmoid, updatePeriod);
    timeDataEngine.connectSource("UTC", plasmoid, updatePeriod);
    
}

function updateGPUTemp(){
    updateGPUTemp.updating = true;
    var path = getTmpFileParentDir();
    var cmd = "nvidia-smi -q  -d TEMPERATURE|grep Gpu|cut -d: -f2>" + path + "/net.ubuntudaily.hwmon.gpu.temp";
    trace(cmd);
    exitCode = plasmoid.runCommand("sh", ["-c", cmd]);  
    gpuTempData="";
    // in case our request for LocalIO in the metadata.desktop was rejected (e.g. due
    // to security restrictions) we won't have a plasmoid.getUrl, so let's check for it
    // before using it!
    if (plasmoid.getUrl) {
        gpuReadJob = plasmoid.getUrl(path + "/net.ubuntudaily.hwmon.gpu.temp");
        gpuReadJob.data.connect(slotGPUDataHandler)
        gpuReadJob.finished.connect(slotGPUDataHandleFinished)
    } else {
        trace(i18n("local file access denied!"));
    }    
}
updateGPUTemp.updating = false;
function slotGPUDataHandler(job, data)
{
    if (job == gpuReadJob) {
        if (data.length) {
            gpuTempData = gpuTempData + data.toUtf8();
        }else{
            gpuTempData = gpuTempData.trim();
        }
    }
}


function slotGPUDataHandleFinished(job)
{
    var temp = "";
    trace("slotGPUDataHandleFinished:" + gpuTempData);
    temp = gpuTempData.trim().substring(0, gpuTempData.indexOf("C") - 1);
    gpuTempLabel.text = '<font color="red">' + 'G' + temp + '</font>';
    updateGPUTemp.updating = false;
}


//----------
function updateHDDTemp(){
    updateHDDTemp.updating = true;
    
    var cmd = "smartctl -A /dev/sda|grep  Temperature_Celsius> " + getTmpFileParentDir() +"/net.ubuntudaily.hwmon.hdd.temp";
    trace(cmd);
    exitCode = plasmoid.runCommand("sh", ["-c", cmd]);  

    // in case our request for LocalIO in the metadata.desktop was rejected (e.g. due
    // to security restrictions) we won't have a plasmoid.getUrl, so let's check for it
    // before using it!
    if (plasmoid.getUrl) {
        readJob = plasmoid.getUrl(getTmpFileParentDir() + "/net.ubuntudaily.hwmon.hdd.temp");
        readJob.data.connect(slotHDDDataHandler)
        readJob.finished.connect(slotHDDDataHandleFinished)
    } else {
        trace(i18n("local file access denied!"));
    }    
}
updateHDDTemp.updating = false;
function slotHDDDataHandler(job, data)
{
    if (job == readJob) {
        if (data.length) {
            hddTempData = hddTempData + data.toUtf8();
        }
    }
}
function slotHDDDataHandleFinished(job)
{
    if (job == readJob) {
        //temp = hddTempData.trim().substring(0, hddTempData.indexOf("C") - 1);
        hddTempLabel.text = '<font color="red">' + hddTempData + '</font>';
        hddTempData = "";
        updateHDDTemp.updating = false;
        trace("HDD Temp:" + temp);
    } else {
        trace("some other job is finished?")
    }
}
//------------
function slotSysMonSourceAdded(name) {
    //print(name);
}
function slotSysMonSourceRemoved(name) {
    // unsubscribe
    smDataEngine.disconnectSource(name, plasmoid);
}    
function isDate(obj){ 
    return (typeof obj=='object')&&obj.constructor==Date; 
} 
String.prototype.trim = function() {
    return this.replace(/^\s+|\s+$/g,"");
}
/**
 * print trace information to console, depending on whether trace is enabled or not.
 * @param {string} message the trace message to be printed to console 
 */
function trace(message){
    if(config.isTraceEnabled){
        message = "trace : " + message;
        print(message);
        traceCmd="echo '" + message + "' >>/tmp/net.ubuntudaily.hwmon.trace.log";
        plasmoid.runCommand("sh", ["-c",traceCmd]);
        
        
    }
}
function getTmpFileParentDir(){
    return tmpFileParentDir.length == 0 ? "/tmp" : tmpFileParentDir;
}
function runShellCmd(cmd, outputData, outputHandler){

    runShellCmd.processing = true;
    var readJob = "";
    var path = getTmpFileParentDir();
    var outputDataFile = path + "/"+ new Date().getTime() + ".tmp";
    var rmOutputDataFileCmd = "rm " + outputDataFile;
    var actualCmd = cmd + ">" + outputDataFile;

    
    
    var exitCode = plasmoid.runCommand("sh", ["-c", actualCmd]);  

    outputData.str = "";
    var dataReceiver = function(job, data){
        trace("recv:"+data.length);
        if (job == readJob) {
            if (data.length > 0) {
                
                outputData.str = outputData.str + data.toUtf8();
            }else{
                outputData.str = outputData.str.trim();
                plasmoid.runCommand("sh", ["-c", rmOutputDataFileCmd]);
            }
        }    
    };    
    // in case our request for LocalIO in the metadata.desktop was rejected (e.g. due
    // to security restrictions) we won't have a plasmoid.getUrl, so let's check for it
    // before using it!
    if (plasmoid.getUrl) {
        trace("outputDataFile:"+outputDataFile);
        readJob = plasmoid.getUrl(outputDataFile);
        readJob.data.connect(dataReceiver);
        readJob.finished.connect(outputHandler);
    } else {
        trace(i18n("local file access denied!"));
    } 
    
}
runShellCmd.processing = false;