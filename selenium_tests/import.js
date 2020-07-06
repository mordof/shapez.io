const { Builder, By, until, logging } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const injectHelpers = require("./injected_helpers");

const Toolbar = "ingame_HUD_buildings_toolbar";
const Tutorial = "ingame_HUD_InteractiveTutorial";
const KeyBindings = "ingame_HUD_KeybindingOverlay";
const Notifications = "ingame_HUD_Notifications";
const PinnedShapes = "ingame_HUD_PinnedShapes";
const PlacementHints = "ingame_HUD_PlacementHints";
const PlacerVariants = "ingame_HUD_PlacerVariants";

exports.ToolbarID = Toolbar;

let options = new chrome.Options();
const prefs = new logging.Preferences();
prefs.setLevel(logging.Type.BROWSER, logging.Level.ALL);
options.setLoggingPrefs(prefs);
options.addArguments("--auto-open-devtools-for-tabs");

let driverCache;

const getDriver = async () => {
    if (driverCache) return driverCache;
    driverCache = await new Builder().forBrowser("chrome").setChromeOptions(options).build();
    driverCache.manage().window().maximize();
    return driverCache;
};

const loadCleanPage = async () => {
    const driver = await getDriver();
    await driver.get("http://localhost:3005");
    await Promise.all([
        driver.wait(until.elementLocated(By.id(Toolbar)), 2000),
        driver.wait(until.elementLocated(By.id(Tutorial)), 2000),
        driver.wait(until.elementLocated(By.id(KeyBindings)), 2000),
        driver.wait(until.elementLocated(By.id(Notifications)), 2000),
        driver.wait(until.elementLocated(By.id(PinnedShapes)), 2000),
    ]);
    await driver.executeScript(
        (tutorialID, keyBindingsID, notificationsID, pinnedShapesID, hintsID, variantsID) => {
            const styles = `
                #${tutorialID}, 
                #${keyBindingsID}, 
                #${notificationsID}, 
                #${pinnedShapesID},
                #${hintsID},
                #${variantsID} {
                    display: none;
                }
            `;

            const css = document.createElement("style");
            css.type = "text/css";

            if (css.styleSheet) css.styleSheet.cssText = styles;
            else css.appendChild(document.createTextNode(styles));

            document.getElementsByTagName("head")[0].appendChild(css);
        },
        Tutorial,
        KeyBindings,
        Notifications,
        PinnedShapes,
        PlacementHints,
        PlacerVariants
    );
    await driver.executeScript(injectHelpers);
    return driver;
};

beforeEach(async () => {
    await loadCleanPage();
});

afterEach(async () => {
    const driver = await getDriver();
    await driver
        .manage()
        .logs()
        .get(logging.Type.BROWSER)
        .then(logs => {
            // So that we can place logs inside of the browser, and see them once the
            // tests are done... however if we don't filter these, we'll end up with
            // absolutely all of shapez.io logs as well making it hard to find ours.
            const testLogs = logs.filter(log => log.message.includes("TESTLOG:"));
            if (testLogs.length > 0) {
                console.log(testLogs);
            }
        });
});

beforeAll(async () => {
    // ridiculous timeout. will be tuned later but for now prevents jest shutting
    // down tests early
    jest.setTimeout(100000000);
    const driver = await getDriver();
});

afterAll(async () => {
    const driver = await getDriver();
    await driver.quit();
});

exports.getDriver = getDriver;
exports.loadCleanPage = loadCleanPage;
