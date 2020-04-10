const appium = require("appium-adb");
const util = require("util");
const path = require("path");
const apkReader = require("adbkit-apkreader");

const packageName = "com.microsoft.accessibilityinsightsforandroidservice";
const serviceName = `${packageName}/.AccessibilityInsightsForAndroidService`;

async function run() {
  const adb = await appium.ADB.createADB();
  const version = await adb.getAdbVersion();

  console.log("adb version: " + util.inspect(version));

  console.log("current working directory", process.cwd());
  console.log("__dirname", __dirname);
  console.log("__filename", __filename);
  console.log(
    "process.env.SYSTEM_DEFAULTWORKINGDIRECTORY",
    process.env.SYSTEM_DEFAULTWORKINGDIRECTORY
  );

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

  await runWithCatch(async () => {
    console.log("Grant all permissions");
    const response = await adb.grantAllPermissions(packageName);
    console.log(`Grant permission Response - ${util.inspect(response)}`);
  });

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
}

function sleep(millis) {
  return new Promise((resolve) => setTimeout(resolve, millis));
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
    await callback();
  } catch (e) {
    console.log(`Exception thrown! ===> ${util.inspect(e)}`);
  }
}
run();
