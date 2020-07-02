require("./import");
const { timeout, placeItem, findClosestResourcePatch, dragBelt, getHubGoals } = require("./helpers");

test("confirms completing level 1 works", async () => {
    expect.assertions(4);

    const circleShape = "CuCuCuCu";

    const patch = await findClosestResourcePatch({ shape: circleShape }, 0, 0);

    await placeItem("miner", patch[0][0].x, patch[0][0].y);
    await dragBelt(patch[0][0].x, patch[0][0].y - 1, -3, 1);

    let nextItem = patch[0];
    let destY = 0;
    let placed = 0;

    do {
        nextItem = patch.find(p => p[0].x === nextItem[0].x - 1 && p[0].y === nextItem[0].y);

        if (nextItem) {
            await placeItem("miner", nextItem[0].x, nextItem[0].y);
            await dragBelt(nextItem[0].x, nextItem[0].y - 1, -3, destY);
            destY--;
            placed++;
        }
    } while (nextItem !== undefined && placed < 3);

    let hubGoals = await getHubGoals();
    const level1GoalShape = hubGoals.currentGoal.definition.cachedHash;
    const level1GoalCount = hubGoals.currentGoal.required;

    expect(level1GoalShape).toBe(circleShape);
    expect(level1GoalCount).toBe(40);

    while (hubGoals.level === 1) {
        await timeout(250);

        hubGoals = await getHubGoals();

        if (hubGoals.level > 1) {
            expect(hubGoals.storedShapes[level1GoalShape]).toBeGreaterThanOrEqual(level1GoalCount);
            expect(hubGoals.level).toBe(2);
        }
    }
});
