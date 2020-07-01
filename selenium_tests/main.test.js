require("./import");
const { clickToolbar, clickTile, timeout, runScript } = require("./helpers");

test("test that selenium actually does something", async () => {
    await clickToolbar("belt");
    await clickTile(-3, -2);

    console.log(
        await runScript(() => {
            return tileToChunk(-17, 17);
        })
    );

    await timeout(10000);
});

test("test that selenium actually does something 2", async () => {
    await clickToolbar("belt");
    await clickTile(3, -2);

    await timeout(10000);
});
