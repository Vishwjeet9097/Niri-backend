"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
beforeAll(async () => {
    try {
        (0, child_process_1.execSync)('createdb niri_test_db || true', { stdio: 'ignore' });
    }
    catch (error) {
        console.warn('Could not create test database:', error.message);
    }
});
afterAll(async () => {
    try {
        (0, child_process_1.execSync)('dropdb niri_test_db || true', { stdio: 'ignore' });
    }
    catch (error) {
        console.warn('Could not drop test database:', error.message);
    }
});
//# sourceMappingURL=jest-e2e.setup.js.map