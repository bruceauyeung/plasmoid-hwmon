
var layout = new LinearLayout(plasmoid);

// display CPU temperature
var cpuTempLabel = new Label();
layout.addItem(cpuTempLabel);
cpuTempLabel.text = "";

// display GPU temperature
var gpuTempLabel = undefined;
gpuTempLabel = new Label();
layout.addItem(gpuTempLabel);
gpuTempLabel.text = '';  

var hddTempLabel = new Label();
layout.addItem(hddTempLabel);
hddTempLabel.text = '';

var timeDataEngine = dataEngine("time");
var smDataEngine = dataEngine("systemmonitor");

var tmpFileParentDir = "";
var tmpFileParentDirExistenceDetectionFinished = false;
var fallbackTmpFileParentDir = "/tmp";
// information read from file net.ubuntudaily.hwmon.gpu.temp
gpuTempData = "";
hddTempData = "";

var nvidiaSmiExists = undefined;

var gpuTempRequestTotalCount = 0;
var gpuTempRequestMissedCount = 0;

var sensorsCpuTempRequestTotalCount = 0;
var sensorsCpuTempRequestMissedCount = 0;

var acpiCpuTempReadable = true;
/**
 * 
 */
var config = {
    isInfoEnabled : true,
    isTraceEnabled : false,
    // unit is millisecond
    updatePeriod : 3000
}
plasmoid.configChanged = function()
{
    plasmoid.activeConfig = "main";
    var updatePeriod = plasmoid.readConfig("updatePeriod");
    config.updatePeriod = updatePeriod * 1000;
    
    if(acpiCpuTempReadable){
        reconnectDataSources(config.updatePeriod);
    }
    
    trace("updatePeriod changed to: " + config.updatePeriod);
    
    
    var traceEnabled = plasmoid.readConfig("traceEnabled");
    
    
    // trace info first, otherwise trace information will not be printed if being changed to false.
    trace("traceEnabled changed to :" + traceEnabled);
    config.isTraceEnabled = traceEnabled == true ? true: false;
    
}
plasmoid.dataUpdated = function(name, data)
{
  
    trace("data source name :" + name);
    if(name == "UTC"){
        
        var userIdOutput = {};
        // when the instance of plasmoid runs at the first time, tmpFileParentDir is empty, so we start to initialize it.
        if(tmpFileParentDir.length == 0){
            
            runShellCmd("id -u", userIdOutput, function(){
                var id = userIdOutput.str.trim();
                if(id){
                    tmpFileParentDir="/run/user/" + id;
                }
            });
        }
        var tmpFileParentDirExistOutput = {};
        if(tmpFileParentDir.length > 0 && !tmpFileParentDirExistenceDetectionFinished){
            runShellCmd("file " + tmpFileParentDir, tmpFileParentDirExistOutput, function(){
                var fileInfo = tmpFileParentDirExistOutput.str.trim();
                if(fileInfo && fileInfo.indexOf("ERROR") != -1){
                    tmpFileParentDir=fallbackTmpFileParentDir;
                }
                tmpFileParentDirExistenceDetectionFinished = true;

            });            
        }

        var nvidiaSmiPathOutput = {};
        if(nvidiaSmiExists === undefined){
            
            runShellCmd("which nvidia-smi", nvidiaSmiPathOutput, function(){
                var nvidiaSmiPath = nvidiaSmiPathOutput.str.trim();
                //trace(nvidiaSmiPath);
                if(nvidiaSmiPath.indexOf("no nvidia-smi in") != -1){
                    nvidiaSmiExists = false;
                    
                }else{
                    nvidiaSmiExists = true;
                }
                trace("nvidiaSmiExists:" + nvidiaSmiExists);
            });
        }
        
        
        var sensorsOutput = {};
        if(!acpiCpuTempReadable){
            
            runShellCmd("sensors|grep temp1|cut -d: -f2", sensorsOutput, function(){
                sensorsCpuTempRequestTotalCount++;
                
                var sensorsCpuTemp = sensorsOutput.str.trim();
                
                var temp = "";
                
                temp = sensorsCpuTemp.substring(sensorsCpuTemp.indexOf("+") + 1, sensorsCpuTemp.indexOf("C") - 1).trim();
                if(temp.length > 0){
                    temp = parseFloat(temp);  
                    if (!isNaN(temp)) {  
                        
                        setCpuTempLabel(Math.round(temp));
                    }else{
                        trace("temp is not a valid number : " + temp);
                    }
                    
                }
                else{
                    sensorsCpuTempRequestMissedCount++;
                    trace("missed to read cpu temperature from sensors : " + sensorsCpuTempRequestMissedCount + " times");
                }
                var percent = new Number((sensorsCpuTempRequestMissedCount/sensorsCpuTempRequestTotalCount)*100);
                percent = percent.toPrecision(4);
                trace("sensorsCpuTemp:" + temp);
                trace("sensorsCpuTempRequestMissedPercent : " + percent + "%");
                
                //runShellCmd.processing=false;
                
            });
        }        
        
        // when the instance of plasmoid runs at the first time, the preceding runShellCmd codes are trying to 
        // initialize global tmpFileParentDir variable but not finished yet, so normally, the following codes 
        // will write temporary files to /tmp directory
        if(nvidiaSmiExists && !updateGPUTemp.updating){
           
           updateGPUTemp();
        }  
        
        var gpuOutput = {};
        
        //this is wierd, why sometimes read blank while running this code block?
//         if(nvidiaSmiExists && !runShellCmd.processing){
//             runShellCmd("nvidia-smi -q  -d TEMPERATURE|grep Gpu|cut -d: -f2", gpuOutput, function(){
//                 gpuTempRequestTotalCount++;
//                 print("runShellCmd:"+gpuOutput.str);
//                 
//                 var gpuTemp = gpuOutput.str;
//                 
//                 var temp = "";
//                 
//                 temp = gpuTemp.trim().substring(0, gpuTemp.indexOf("C") - 1).trim();
//                 if(temp.length > 0){
//                     gpuTempLabel.text = '<font color="red">' + 'G' + temp + '</font>';
//                 }
//                 else{
//                     gpuTempRequestMissedCount++;
//                 }
//                 trace("gpuTempRequestMissedPercent : " + gpuTempRequestMissedCount/gpuTempRequestTotalCount + "%");
//                 
//                 runShellCmd.processing=false;
//                 
//             });
//         }
        
        //!updateHDDTemp.updating
        if(false){
            updateHDDTemp();
        }
    }else if(name == "acpi/Thermal_Zone/0/Temperature"){
        trace("data received : " + obj2Str(data));
        if(data["name"] != "undefined" 
            && typeof(data["name"]) == "string" 
            && data["name"].indexOf("temperature") != -1 
            && typeof(data["value"]) != "undefined"){
            setCpuTempLabel(data["value"]);
            trace("CPU Temp:" + data["value"]);
        }else{
            acpiCpuTempReadable = false;
            slotSysMonSourceRemoved("acpi/Thermal_Zone/0/Temperature");
            trace("can not read cpu temperature from systemmonitor dataEngine");
        }        
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
 
if(acpiCpuTempReadable){
    var connected = smDataEngine.connectSource("acpi/Thermal_Zone/0/Temperature", plasmoid, config.updatePeriod);
    if(connected){
        smDataEngine.sourceRemoved.connect(slotSysMonSourceRemoved);
        smDataEngine.sourceAdded.connect(slotSysMonSourceAdded);    
        info("finished to connect data source 'acpi/Thermal_Zone/0/Temperature'");
    }else{
        acpiCpuTempReadable = false;
        info("failed to connect data source 'acpi/Thermal_Zone/0/Temperature'");
    }
}


timeDataEngine.connectSource("UTC", plasmoid, config.updatePeriod);





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
    gpuTempRequestTotalCount++;
    var temp = "";
    trace("slotGPUDataHandleFinished:" + gpuTempData);
    
    temp = gpuTempData.trim().substring(0, gpuTempData.indexOf("C") - 1);
    if(temp.length > 0){
        gpuTempLabel.text = '<font color="red">' + 'G' + temp + '</font>';
    }
    else{
        gpuTempRequestMissedCount++;
    }
    var percent = new Number((gpuTempRequestMissedCount/gpuTempRequestTotalCount)*100);
    percent = percent.toPrecision(4); 
    trace("gpuTempRequestMissedPercent : " + percent + "%");
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
function trace(message, traceFile){
    if(config.isTraceEnabled){
        message = "trace : " + message;
        print(message);
        if(!traceFile){
            traceFile = "/tmp/net.ubuntudaily.hwmon.trace.log";
        }
        traceCmd="echo '" + message + "' >>" + traceFile;
        plasmoid.runCommand("sh", ["-c",traceCmd]);
        
        
    }
}
function info(message, infoFile){
    if(config.isInfoEnabled){
        message = "info : " + message;
        print(message);
        if(!infoFile){
            infoFile = "/tmp/net.ubuntudaily.hwmon.info.log";
        }
        infoCmd="echo '" + message + "' >>" + infoFile;
        plasmoid.runCommand("sh", ["-c",infoCmd]);
        
        
    }
}
function setCpuTempLabel(temp){
    cpuTempLabel.text = '<font color="yellow">' + 'C' + temp + '</font>';
}
function getTmpFileParentDir(){
    if(!tmpFileParentDirExistenceDetectionFinished){
        return fallbackTmpFileParentDir;
    }
    return tmpFileParentDir.length == 0 ? fallbackTmpFileParentDir : tmpFileParentDir;
}
function runShellCmd(cmd, outputData, outputHandler){

    runShellCmd.processing = true;
    var readJob = "";
    var path = getTmpFileParentDir();
    var outputDataFile = path + "/"+ new Date().getTime() + ".tmp";
    var rmOutputDataFileCmd = "rm " + outputDataFile;
    var actualCmd = cmd + ">" + outputDataFile;
    actualCmd = actualCmd + " && sleep 0.1";
    
    trace("runShellCmd:" + actualCmd);
    var exitCode = plasmoid.runCommand("sh", ["-c", actualCmd]);
    plasmoid.runCommand("sh", ["-c","echo '   '>>"+outputDataFile]);
    //trace("exitCode:" + exitCode);
    outputData.str = "";
    var dataReceiver = function(job, data){
        //trace(obj2Str(job));
        //trace("job:" + job.name +  ",recv:"+data.length);
        if (job == readJob) {
            if (data.length > 0) {
                
                outputData.str = outputData.str + data.toUtf8();
            }else{
                outputData.str = outputData.str.trim();
                job.kill();
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