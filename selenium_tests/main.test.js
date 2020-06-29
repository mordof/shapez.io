const { loadCleanPage, clickToolbar, clickTile } = require("./import");

test("test that selenium actually does something", async () => {
    await clickToolbar("belt");
    await clickTile(-3, -2);
});

test("test that selenium actually does something 2", async () => {
    await clickToolbar("belt");
    await clickTile(3, -2);
});
