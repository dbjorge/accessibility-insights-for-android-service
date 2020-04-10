const appium = require('appium-adb');
const util = require('util');
const path = require('path');
const apkReader = require('adbkit-apkreader');

async function run() {
    const adb = await appium.ADB.createADB();
    const version = await adb.getAdbVersion();

    console.log('adb version: ' + util.inspect(version));

    const apkPath = path.resolve(
        __dirname,
        '/AccessibilityInsightsForAndroidService/app/build/outputs/apk/debug/app-debug.apk',
    );

    const packageName = 'com.microsoft.accessibilityinsightsforandroidservice';

    await runWithCatch(async () => {
        console.log('reading manifest file');
        const manifest = await apkReader.open(apkPath);
        const content = await manifest.readManifest();
        console.log(`manifest content \n ${util.inspect(content)}`);
    });

    await runWithCatch(async () => {
        let response = await adb.isAppInstalled(packageName);
        console.log(`is app installed - ${response}`);

        if (response === true) {
            console.log('Uninstalling apk');
            response = await adb.uninstallApk(packageName);
            console.log(`Uninstall Response - ${util.inspect(response)}`);
        }
    });

    await runWithCatch(async () => {
        console.log('Installing apk');
        const response = await adb.install(apkPath);
        console.log(`Install Response - ${util.inspect(response)}`);
    });

    // await runWithCatch(async () => {
    //     console.log('installOrUpgrade apk');
    //     const response = await adb.installOrUpgrade(apkPath);
    //     console.log(`installOrUpgrade - ${util.inspect(response)}`);
    // });

    await runWithCatch(async () => {
        console.log('Grant all permissions');
        const response = await adb.grantAllPermissions(packageName);
        console.log(`Grant permission Response - ${util.inspect(response)}`);
    });

    await checkIfServiceIsRunning(adb);

    await runWithCatch(async () => {
        console.log('Start service');
        //adb shell settings put secure enabled_accessibility_services com.microsoft.accessibilityinsightsforandroidservice/com.microsoft.accessibilityinsightsforandroidservice.AccessibilityInsightsForAndroidService
        const response = await adb.shell([
            'settings',
            'put',
            'secure',
            'enabled_accessibility_services',
            'com.microsoft.accessibilityinsightsforandroidservice/com.microsoft.accessibilityinsightsforandroidservice.AccessibilityInsightsForAndroidService',
        ]);

        console.log(`start service response - ${util.inspect(response)}`);
    });

    await checkIfServiceIsRunning(adb);
}

async function checkIfServiceIsRunning(adb) {
    await runWithCatch(async () => {
        console.log('Checking if service is running');
        let response = await adb.shell([
            'dumpsys',
            'activity',
            'services',
            'com.microsoft.accessibilityinsightsforandroidservice/com.microsoft.accessibilityinsightsforandroidservice.AccessibilityInsightsForAndroidService',
        ]);

        console.log(`Is Service running response - ${response}\n`);

        response = await adb.shell(['dumpsys', 'accessibility']);
        console.log(`Enabled accessibility services response - ${response}`);
    });
}

async function runWithCatch(callback) {
    try {
        console.log('\n\n');
        await callback();
    } catch (e) {
        console.log(`Exception thrown! ===> ${util.inspect(e)}`);
    }
}
run();
