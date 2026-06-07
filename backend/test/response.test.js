import { strict as assert } from "assert";

// Inline sendSuccess / sendError to test their contract
const sendSuccess = (res, statusCode = 200, message = "Success", data = null) => {
    const response = { success: true, message };
    if (data !== null) response.data = data;
    return res.status(statusCode).json(response);
};

const sendError = (res, statusCode = 500, message = "Internal Server Error", errors = null) => {
    const response = { success: false, message };
    if (errors !== null) response.errors = errors;
    return res.status(statusCode).json(response);
};

// Minimal mock response object
function mockRes() {
    const res = { _status: null, _body: null };
    res.status = (code) => { res._status = code; return res; };
    res.json = (body) => { res._body = body; return res; };
    return res;
}

describe("sendSuccess()", () => {
    it("sets success:true, correct statusCode and message", () => {
        const res = mockRes();
        sendSuccess(res, 200, "OK", { foo: 1 });
        assert.equal(res._status, 200);
        assert.equal(res._body.success, true);
        assert.equal(res._body.message, "OK");
        assert.deepEqual(res._body.data, { foo: 1 });
    });

    it("omits data key when data is null", () => {
        const res = mockRes();
        sendSuccess(res, 201, "Created");
        assert.ok(!("data" in res._body));
    });

    it("includes data for falsy but non-null values", () => {
        const res = mockRes();
        sendSuccess(res, 200, "OK", 0);
        assert.ok("data" in res._body);
    });
});

describe("sendError()", () => {
    it("sets success:false, correct statusCode and message", () => {
        const res = mockRes();
        sendError(res, 404, "Not found");
        assert.equal(res._status, 404);
        assert.equal(res._body.success, false);
        assert.equal(res._body.message, "Not found");
    });

    it("omits errors key when errors is null", () => {
        const res = mockRes();
        sendError(res, 400, "Bad request");
        assert.ok(!("errors" in res._body));
    });

    it("includes errors when provided", () => {
        const res = mockRes();
        sendError(res, 422, "Validation failed", [{ field: "email", message: "required" }]);
        assert.ok(Array.isArray(res._body.errors));
        assert.equal(res._body.errors[0].field, "email");
    });
});
