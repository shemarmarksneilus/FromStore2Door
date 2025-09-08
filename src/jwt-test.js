"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var axios = require('axios');
var API_URL = 'http://localhost:3000';
// Handle errors consistently
function handleError(error, exit) {
    if (exit === void 0) { exit = false; }
    if (error && typeof error === 'object') {
        if (error.response && error.response.status) {
            console.error('API Error:', error.response.status, error.response.data);
        }
        else if (error.code === 'ECONNREFUSED') {
            console.error('Server not running - start with: npm run dev');
        }
        else if (error instanceof Error) {
            console.error('Error:', error.message);
        }
        else {
            console.error('Unknown error:', error);
        }
    }
    else {
        console.error('Unexpected error type:', error);
    }
    if (exit) {
        process.exit(1);
    }
}
function testJWTAuth() {
    return __awaiter(this, void 0, void 0, function () {
        var authToken, refreshToken, healthResponse, registerData, registerResponse, error_1, loginResponse, meResponse, refreshResponse, newToken, meResponse2, accountResponse, updateResponse, error_2, passwordChangeResponse, loginNewResponse, error_3, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('Testing JWT Authentication System\n');
                    authToken = '';
                    refreshToken = '';
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 25, , 26]);
                    // Test 1: Health check
                    console.log('1. Testing health endpoint...');
                    return [4 /*yield*/, axios.get("".concat(API_URL, "/health"))];
                case 2:
                    healthResponse = _a.sent();
                    console.log('Health check:', healthResponse.data.status);
                    // Test 2: Register user
                    console.log('\n2. Testing user registration...');
                    registerData = {
                        email: 'testuser@example.com',
                        password: 'securepassword123',
                        fullName: 'Test User JWT',
                        phone: '+1234567890'
                    };
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, axios.post("".concat(API_URL, "/api/auth/register"), registerData)];
                case 4:
                    registerResponse = _a.sent();
                    console.log('User registered:', registerResponse.data.user.email);
                    authToken = registerResponse.data.token;
                    refreshToken = registerResponse.data.refreshToken;
                    return [3 /*break*/, 6];
                case 5:
                    error_1 = _a.sent();
                    if (error_1 === 409) {
                        console.log('User already exists, proceeding with login...');
                    }
                    else {
                        handleError(error_1, true);
                    }
                    return [3 /*break*/, 6];
                case 6:
                    // Test 3: Login user
                    console.log('\n3. Testing user login...');
                    if (!!authToken) return [3 /*break*/, 8];
                    return [4 /*yield*/, axios.post("".concat(API_URL, "/api/auth/login"), {
                            email: registerData.email,
                            password: registerData.password
                        })];
                case 7:
                    loginResponse = _a.sent();
                    console.log('Login successful:', loginResponse.data.user.email);
                    authToken = loginResponse.data.token;
                    refreshToken = loginResponse.data.refreshToken;
                    _a.label = 8;
                case 8:
                    // Test 4: Get current user (protected route)
                    console.log('\n4. Testing protected route /auth/me...');
                    return [4 /*yield*/, axios.get("".concat(API_URL, "/api/auth/me"), {
                            headers: {
                                'Authorization': "Bearer ".concat(authToken)
                            }
                        })];
                case 9:
                    meResponse = _a.sent();
                    console.log('Current user:', meResponse.data.user.fullName);
                    // Test 5: Test refresh token
                    console.log('\n5. Testing token refresh...');
                    return [4 /*yield*/, axios.post("".concat(API_URL, "/api/auth/refresh"), {
                            refreshToken: refreshToken
                        })];
                case 10:
                    refreshResponse = _a.sent();
                    console.log('Token refreshed successfully');
                    newToken = refreshResponse.data.token;
                    // Test 6: Test with new token
                    console.log('\n6. Testing with refreshed token...');
                    return [4 /*yield*/, axios.get("".concat(API_URL, "/api/auth/me"), {
                            headers: {
                                'Authorization': "Bearer ".concat(newToken)
                            }
                        })];
                case 11:
                    meResponse2 = _a.sent();
                    console.log('New token works:', meResponse2.data.user.email);
                    // Test 7: Test account management
                    console.log('\n7. Testing account management...');
                    return [4 /*yield*/, axios.get("".concat(API_URL, "/api/accounts/me"), {
                            headers: {
                                'Authorization': "Bearer ".concat(authToken)
                            }
                        })];
                case 12:
                    accountResponse = _a.sent();
                    console.log('Account details:', accountResponse.data.fullName);
                    // Test 8: Update account info
                    console.log('\n8. Testing account update...');
                    return [4 /*yield*/, axios.put("".concat(API_URL, "/api/accounts/me"), {
                            fullName: 'Updated Test User',
                            phone: '+9876543210'
                        }, {
                            headers: {
                                'Authorization': "Bearer ".concat(authToken)
                            }
                        })];
                case 13:
                    updateResponse = _a.sent();
                    console.log('Account updated:', updateResponse.data.fullName);
                    // Test 9: Test role-based access (should fail for regular user)
                    console.log('\n9. Testing role-based access control...');
                    _a.label = 14;
                case 14:
                    _a.trys.push([14, 16, , 17]);
                    return [4 /*yield*/, axios.get("".concat(API_URL, "/api/auth/users"), {
                            headers: {
                                'Authorization': "Bearer ".concat(authToken)
                            }
                        })];
                case 15:
                    _a.sent();
                    console.log('Should have failed - user has admin access when they shouldn\'t');
                    return [3 /*break*/, 17];
                case 16:
                    error_2 = _a.sent();
                    if (error_2 === 403) {
                        console.log('Role-based access control working - access denied');
                    }
                    else {
                        handleError(error_2, true);
                    }
                    return [3 /*break*/, 17];
                case 17:
                    // Test 10: Test password change
                    console.log('\n10. Testing password change...');
                    return [4 /*yield*/, axios.post("".concat(API_URL, "/api/auth/change-password"), {
                            currentPassword: 'securepassword123',
                            newPassword: 'newsecurepassword123'
                        }, {
                            headers: {
                                'Authorization': "Bearer ".concat(authToken)
                            }
                        })];
                case 18:
                    passwordChangeResponse = _a.sent();
                    console.log('Password changed successfully');
                    // Test 11: Login with new password
                    console.log('\n11. Testing login with new password...');
                    return [4 /*yield*/, axios.post("".concat(API_URL, "/api/auth/login"), {
                            email: registerData.email,
                            password: 'newsecurepassword123'
                        })];
                case 19:
                    loginNewResponse = _a.sent();
                    console.log('Login with new password successful');
                    // Test 12: Test logout
                    console.log('\n12. Testing logout...');
                    return [4 /*yield*/, axios.post("".concat(API_URL, "/api/auth/logout"), {
                            refreshToken: refreshToken
                        }, {
                            headers: {
                                'Authorization': "Bearer ".concat(authToken)
                            }
                        })];
                case 20:
                    _a.sent();
                    console.log('Logout successful');
                    // Test 13: Test invalid refresh token after logout
                    console.log('\n13. Testing invalid refresh token after logout...');
                    _a.label = 21;
                case 21:
                    _a.trys.push([21, 23, , 24]);
                    return [4 /*yield*/, axios.post("".concat(API_URL, "/api/auth/refresh"), {
                            refreshToken: refreshToken
                        })];
                case 22:
                    _a.sent();
                    console.log('Should have failed - refresh token should be invalid');
                    return [3 /*break*/, 24];
                case 23:
                    error_3 = _a.sent();
                    if (error_3 === 401) {
                        console.log('Refresh token properly invalidated');
                    }
                    else {
                        handleError(error_3, true);
                    }
                    return [3 /*break*/, 24];
                case 24:
                    console.log('\n All JWT authentication tests passed!');
                    return [3 /*break*/, 26];
                case 25:
                    error_4 = _a.sent();
                    handleError(error_4, true);
                    return [3 /*break*/, 26];
                case 26: return [2 /*return*/];
            }
        });
    });
}
function testCompleteWorkflow() {
    return __awaiter(this, void 0, void 0, function () {
        var adminData, adminToken, adminRegisterResponse, pool, adminLoginResponse, error_5, adminLoginResponse, usersResponse, warehouseResponse, packageResponse, error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('\nTesting Complete Workflow\n');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 14, , 15]);
                    adminData = {
                        email: 'admin@example.com',
                        password: 'adminpassword123',
                        fullName: 'Admin User',
                        role: 'admin'
                    };
                    adminToken = '';
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 6, , 10]);
                    return [4 /*yield*/, axios.post("".concat(API_URL, "/api/auth/register"), adminData)];
                case 3:
                    adminRegisterResponse = _a.sent();
                    adminToken = adminRegisterResponse.data.token;
                    console.log('Admin user registered');
                    pool = require('./src/config/database').pool;
                    return [4 /*yield*/, pool.query('UPDATE accounts SET role = $1 WHERE email = $2', ['admin', adminData.email])];
                case 4:
                    _a.sent();
                    console.log('Admin role assigned manually');
                    return [4 /*yield*/, axios.post("".concat(API_URL, "/api/auth/login"), {
                            email: adminData.email,
                            password: adminData.password
                        })];
                case 5:
                    adminLoginResponse = _a.sent();
                    adminToken = adminLoginResponse.data.token;
                    return [3 /*break*/, 10];
                case 6:
                    error_5 = _a.sent();
                    if (!(error_5 === 409)) return [3 /*break*/, 8];
                    return [4 /*yield*/, axios.post("".concat(API_URL, "/api/auth/login"), {
                            email: adminData.email,
                            password: adminData.password
                        })];
                case 7:
                    adminLoginResponse = _a.sent();
                    adminToken = adminLoginResponse.data.token;
                    console.log('Admin login successful');
                    return [3 /*break*/, 9];
                case 8:
                    handleError(error_5, true);
                    _a.label = 9;
                case 9: return [3 /*break*/, 10];
                case 10:
                    // Test admin endpoints
                    console.log('\nTesting admin endpoints...');
                    return [4 /*yield*/, axios.get("".concat(API_URL, "/api/auth/users"), {
                            headers: {
                                'Authorization': "Bearer ".concat(adminToken)
                            }
                        })];
                case 11:
                    usersResponse = _a.sent();
                    console.log("Users list retrieved: ".concat(usersResponse.data.users.length, " users found"));
                    // Create warehouse
                    console.log('\nTesting warehouse creation...');
                    return [4 /*yield*/, axios.post("".concat(API_URL, "/api/warehouses"), {
                            name: 'Test Warehouse JWT',
                            type: 'local',
                            address: {
                                street: '123 Test St',
                                city: 'Kingston',
                                country: 'Jamaica'
                            },
                            timezone: 'America/Jamaica'
                        })];
                case 12:
                    warehouseResponse = _a.sent();
                    console.log('Warehouse created:', warehouseResponse.data.name);
                    // Create package
                    console.log('\nTesting package creation...');
                    return [4 /*yield*/, axios.post("".concat(API_URL, "/api/packages/receive"), {
                            trackingNo: 'JWT-TEST-' + Date.now(),
                            warehouseId: warehouseResponse.data.id,
                            weight: 1.5,
                            dimensions: { length: 20, width: 15, height: 10 },
                            declaredValue: 50.00,
                            contents: 'Test Item'
                        })];
                case 13:
                    packageResponse = _a.sent();
                    console.log('Package received:', packageResponse.data.tracking_no);
                    console.log('\n✅ Complete workflow test passed!');
                    return [3 /*break*/, 15];
                case 14:
                    error_6 = _a.sent();
                    handleError(error_6);
                    return [3 /*break*/, 15];
                case 15: return [2 /*return*/];
            }
        });
    });
}
// Run tests
function runAllTests() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, testJWTAuth()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, testCompleteWorkflow()];
                case 2:
                    _a.sent();
                    console.log('\nAll tests completed successfully!');
                    process.exit(0);
                    return [2 /*return*/];
            }
        });
    });
}
runAllTests();
