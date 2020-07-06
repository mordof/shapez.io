require("./import");
const {
    timeout,
    placeItem,
    findClosestResourcePatch,
    getEntityAtTile,
    dragBelt,
    getHubGoals,
} = require("./test_helpers");

// test("check variants", async () => {
//     // not all of these get placed for some reason.
//     // not sure what the issue is yet, and it's sporadic
//     // as to which gets missed (sometimes it places them all too)
//     await placeItem("splitter", -2, 3, "top", 1);
//     await placeItem("splitter", -2, 4, "top", 2);
//     await placeItem("splitter", -2, 5, "top", 3);
//     await placeItem("splitter", -2, 6, "top", 1);
//     await placeItem("splitter", -2, 7, "top", 3);
//     await placeItem("splitter", -2, 8, "top", 2);
//     await placeItem("splitter", -2, 9, "top", 1);
//     await placeItem("splitter", -2, 10, "top", 3);
//     await timeout(100000);
// });

describe("basic checks to ensure buildings are operating", () => {
    describe("belt", () => {
        test("check transfer of items", async () => {
            const circleShape = "CuCuCuCu";

            const [[tileVec]] = await findClosestResourcePatch({ shape: circleShape }, 0, 0);

            await placeItem("miner", tileVec.x, tileVec.y);
            await placeItem("belt", tileVec.x, tileVec.y - 1);
            await timeout(3200);

            const entity = await getEntityAtTile(tileVec.x, tileVec.y - 1);
            const entityItem = entity.components.ItemEjector.slots[0].item;

            expect(entityItem).not.toBeNull();
            expect(entityItem.definition.cachedHash).toBe(circleShape);
        });
    });

    describe("miner", () => {
        describe("different shape/color output tests", () => {
            [
                { name: "circle", shape: "CuCuCuCu" },
                { name: "square", shape: "RuRuRuRu" },
            ].forEach(({ name, shape }) => {
                test(name, async () => {
                    const circleShape = shape;

                    const [[tileVec]] = await findClosestResourcePatch({ shape: circleShape }, 0, 0);

                    await placeItem("miner", tileVec.x, tileVec.y);
                    // gotta give the miner enough time to mine
                    await timeout(2500);

                    const entity = await getEntityAtTile(tileVec.x, tileVec.y);
                    const entityItem = entity.components.ItemEjector.slots[0].item;

                    expect(entityItem).not.toBeNull();
                    expect(entityItem.definition.cachedHash).toBe(circleShape);
                });
            });

            ["red", "green", "blue"].forEach(color => {
                test(color, async () => {
                    const [[tileVec]] = await findClosestResourcePatch({ color }, 0, 0);

                    await placeItem("miner", tileVec.x, tileVec.y);
                    // gotta give the miner enough time to mine
                    await timeout(2500);

                    const entity = await getEntityAtTile(tileVec.x, tileVec.y);
                    const entityItem = entity.components.ItemEjector.slots[0].item;

                    expect(entityItem).not.toBeNull();
                    expect(entityItem.color).toBe(color);
                });
            });
        });
    });
});
