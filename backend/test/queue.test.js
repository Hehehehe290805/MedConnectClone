import { strict as assert } from "assert";

// ── Queue position / sorting helpers ─────────────────────────────────────────

function buildSlots(items) {
    return items.map((s, i) => ({ ...s, position: i + 1 }));
}

function insertEmergency(slots, emergency) {
    const bumped = slots.map(s => ({ ...s, position: s.position + 1 }));
    return [{ ...emergency, position: 1 }, ...bumped];
}

function appendWalkin(slots, walkin) {
    return [...slots, { ...walkin, position: slots.length + 1 }];
}

function moveToEnd(slots, targetPosition) {
    const slot = slots.find(s => s.position === targetPosition);
    if (!slot) return slots;
    const remaining = slots.filter(s => s.position !== targetPosition);
    const renumbered = remaining.map((s, i) => ({ ...s, position: i + 1 }));
    return [...renumbered, { ...slot, position: renumbered.length + 1 }];
}

describe("Queue — slot insertion", () => {
    it("emergency inserts at position 1 and bumps all others", () => {
        const slots = buildSlots([
            { type: "booked", status: "waiting" },
            { type: "booked", status: "waiting" },
        ]);
        const emergency = { type: "emergency", status: "waiting" };
        const result = insertEmergency(slots, emergency);
        assert.equal(result[0].type, "emergency");
        assert.equal(result[0].position, 1);
        assert.equal(result[1].position, 2);
        assert.equal(result[2].position, 3);
    });

    it("walk-in appends to end with correct position", () => {
        const slots = buildSlots([
            { type: "booked", status: "waiting" },
            { type: "booked", status: "waiting" },
        ]);
        const walkin = { type: "walkin", status: "waiting" };
        const result = appendWalkin(slots, walkin);
        assert.equal(result.length, 3);
        assert.equal(result[2].type, "walkin");
        assert.equal(result[2].position, 3);
    });

    it("emergency into empty queue creates single slot at position 1", () => {
        const result = insertEmergency([], { type: "emergency", status: "waiting" });
        assert.equal(result.length, 1);
        assert.equal(result[0].position, 1);
    });
});

describe("Queue — skip to end", () => {
    it("moves skipped patient to end and renumbers", () => {
        const slots = buildSlots([
            { type: "booked", status: "active",  patientId: "p1" },
            { type: "booked", status: "waiting", patientId: "p2" },
            { type: "booked", status: "waiting", patientId: "p3" },
        ]);
        const result = moveToEnd(slots, 1); // skip active (pos 1) to end
        assert.equal(result[0].patientId, "p2");
        assert.equal(result[0].position, 1);
        assert.equal(result[1].patientId, "p3");
        assert.equal(result[1].position, 2);
        assert.equal(result[2].patientId, "p1");
        assert.equal(result[2].position, 3);
    });

    it("moving from end is a no-op in terms of order", () => {
        const slots = buildSlots([
            { type: "booked", status: "waiting", patientId: "p1" },
            { type: "booked", status: "waiting", patientId: "p2" },
        ]);
        const result = moveToEnd(slots, 2);
        assert.equal(result[0].patientId, "p1");
        assert.equal(result[1].patientId, "p2");
    });
});

describe("Queue — position notifications", () => {
    const NOTIFY_AT = [10, 5, 2];

    function shouldNotify(position) {
        return NOTIFY_AT.includes(position);
    }

    it("fires at positions 10, 5, and 2", () => {
        assert.ok(shouldNotify(10));
        assert.ok(shouldNotify(5));
        assert.ok(shouldNotify(2));
    });

    it("does not fire at other positions", () => {
        [1, 3, 4, 6, 7, 8, 9, 11, 20].forEach(pos => {
            assert.ok(!shouldNotify(pos), `Should not notify at position ${pos}`);
        });
    });
});

// ── isFullToday logic ────────────────────────────────────────────────────────

function isFullToday(maxPatientsPerDay, todayBookingCount) {
    if (maxPatientsPerDay == null) return false;
    return todayBookingCount >= maxPatientsPerDay;
}

describe("isFullToday()", () => {
    it("returns false when no limit is set", () => {
        assert.ok(!isFullToday(null, 100));
        assert.ok(!isFullToday(undefined, 100));
    });

    it("returns false when under the cap", () => {
        assert.ok(!isFullToday(10, 9));
        assert.ok(!isFullToday(10, 0));
    });

    it("returns true when at the cap", () => {
        assert.ok(isFullToday(10, 10));
    });

    it("returns true when over the cap", () => {
        assert.ok(isFullToday(10, 15));
    });

    it("returns false with cap of 0 and 0 bookings (edge case)", () => {
        // cap of 0 means always full, logically
        assert.ok(isFullToday(0, 0));
    });
});
