const { createAiModelsTable } = require("../database/createTables");

const run = async () => {
    try {
        console.log("Recreating AI Models table...");
        await createAiModelsTable();
        console.log("Done.");
        process.exit(0);
    } catch (err) {
        console.error("Failed:", err);
        process.exit(1);
    }
};

run();
