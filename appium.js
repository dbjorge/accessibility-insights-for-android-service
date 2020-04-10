const appium = require("appium-adb");
const util = require("util");
const path = require("path");
const apkReader = require("adbkit-apkreader");
const getPort = require("get-port");

const packageName = "com.microsoft.accessibilityinsightsforandroidservice";
const serviceName = `${packageName}/.AccessibilityInsightsForAndroidService`;

async function run() {
  const adb = await appium.ADB.createADB();
  const version = await adb.getAdbVersion();

  console.log("adb version: " + util.inspect(version));

  const apkPath = path.resolve(
    `${__dirname}/AccessibilityInsightsForAndroidService/app/build/outputs/apk/debug/app-debug.apk`
  );

  console.log(`apk path ${apkPath}`);

  await runWithCatch(async () => {
    console.log("reading manifest file");
    const manifest = await apkReader.open(apkPath);
    const content = await manifest.readManifest();
    console.log(`manifest content \n ${util.inspect(content)}`);
  });

  await runWithCatch(async () => {
    console.log(
      "select device. We need to do this if there are multiple devices connected"
    );

    const devices = await adb.getDevicesWithRetry(); // or adb.getConnectedDevices()
    console.log(`found connected devices - `, util.inspect(devices));

    console.log("selecting the first device ", devices[0]);

    await adb.setDeviceId(devices[0].udid);
  });

  await printApiLevel(adb);

  await runWithCatch(async () => {
    let response = await adb.isAppInstalled(packageName);
    console.log(`is app installed - ${response}`);

    if (response === true) {
      console.log("Uninstalling apk");
      response = await adb.uninstallApk(packageName);
      console.log(`Uninstall Response - ${util.inspect(response)}`);
    }
  });

  await runWithCatch(async () => {
    console.log("Installing apk");
    const response = await adb.install(apkPath);
    console.log(`Install Response - ${util.inspect(response)}`);
  });

  await runWithCatch(async () => {
    let response = await adb.isAppInstalled(packageName);
    console.log(`is app installed - ${response}`);
  });

  // await runWithCatch(async () => {
  //     console.log('installOrUpgrade apk');
  //     const response = await adb.installOrUpgrade(apkPath);
  //     console.log(`installOrUpgrade - ${util.inspect(response)}`);
  // });

  // await runWithCatch(async () => {
  //   console.log("Grant all permissions");
  //   const response = await adb.grantAllPermissions(packageName);
  //   console.log(`Grant permission Response - ${util.inspect(response)}`);
  // });

  await checkIfServiceIsRunning(adb);

  await runWithCatch(async () => {
    console.log("Start service");
    //adb shell settings put secure enabled_accessibility_services com.microsoft.accessibilityinsightsforandroidservice/com.microsoft.accessibilityinsightsforandroidservice.AccessibilityInsightsForAndroidService
    const response = await adb.shell([
      "settings",
      "put",
      "secure",
      "enabled_accessibility_services",
      serviceName,
    ]);

    console.log(`start service response - ${util.inspect(response)}`);
  });

  await sleep(5000);

  await checkIfServiceIsRunning(adb);

  await grantScreenShotPermission(adb);

  await removeForwardedPorts(adb);

  await runWithCatch(async () => {
    console.log("Forwarding port");
    const availablePort = await getPort();
    console.log("available port fetched - ", availablePort);

    await adb.forwardPort(availablePort, 62442);

    console.log(
      `##vso[task.setvariable variable=aiserviceport]${availablePort}`
    );
  });

  await getForwardedPorts(adb);
}

async function printApiLevel(adb) {
  await runWithCatch(async () => {
    console.log("Fetching device api level");
    const level = await adb.shell(["getprop", "ro.build.version.sdk"]);
    console.log(`Api level: ${level}`);
  });
}

async function removeForwardedPorts(adb) {
  await runWithCatch(async () => {
    console.log(
      "We can either use the existing port if available or \
    remove the previously configured port & create a new one. \
    For this spike, choosing to remove the existing port."
    );
    const portsInfo = await getForwardedPorts(adb);

    for (let i = 0; i < portsInfo.length; i++) {
      let portInfoParts = portsInfo[i].split(" ");
      let pcPort = portInfoParts[1].substring(4);
      let devicePort = portInfoParts[2].substring(4);

      if (devicePort === "62442") {
        console.log(`removing port forward for pc port ${pcPort}`);
        await adb.removePortForward(pcPort);
      }
    }
  });
}

async function grantScreenShotPermission(adb) {
  return await runWithCatch(async () => {
    console.log("Pressing tab to select cancel");
    await adb.shell(["input", "keyevent", "61"]);
    await sleep(1000);

    console.log("Pressing tab to select start now");
    await adb.shell(["input", "keyevent", "61"]);
    await sleep(1000);

    console.log("Pressing enter to click start now");
    await adb.shell(["input", "keyevent", "66"]);
    await sleep(1000);
  });
}

async function getForwardedPorts(adb) {
  return await runWithCatch(async () => {
    console.log("list all forwarded ports");
    const deviceForwardedPorts = await adb.getForwardList();
    console.log(
      "Current device forwarded ports",
      util.inspect(deviceForwardedPorts)
    );

    return deviceForwardedPorts;
  });
}

async function sleep(milliseconds) {
  console.log(`Sleeping ${milliseconds} milliseconds`);
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function checkIfServiceIsRunning(adb) {
  await runWithCatch(async () => {
    console.log("Checking if service is running");
    let response = await adb.shell([
      "dumpsys",
      "activity",
      "services",
      serviceName,
    ]);

    console.log(`Is Service running response - ${response}\n`);

    response = await adb.shell(["dumpsys", "accessibility"]);
    console.log(`Enabled accessibility services response - ${response}`);
  });
}

async function runWithCatch(callback) {
  try {
    console.log("\n\n");
    return await callback();
  } catch (e) {
    console.log(`Exception thrown! ===> ${util.inspect(e)}`);
  }
}

run();
