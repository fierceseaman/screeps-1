var assert = require("assert")
const _ = require("lodash")
require("./lib")

describe("utils", function () {
    beforeEach(function() {
        Game.reset()
        Memory.reset()
    })
    var u = require("../src/utils.js")
    describe("#roomNameToPos()", function () {
        it("should be reverseable", function () {
            const rooms = ["E10N15", "E10S21", "W3S5", "W0N0", "E0S0"]
            for(const room of rooms) {
                const converted = u.roomPosToName(u.roomNameToPos(room))
                assert.equal(room, converted)
            }
        })
    })

    describe("#generateRoomList()", function () {
        const rooms = u.generateRoomList(-5, -5, 10, 10)
        it("should have corner cases", function () {
            const corners = ["W5S5", "W5N4", "E4S5", "E4N4"]
            const outers = ["W6S5", "W5N5", "E4S6", "E5N4"]

            _(corners).forEach(corner => assert(rooms.includes(corner)))
            _(outers).forEach(outer => assert(!rooms.includes(outer)))
        })

        it("should be the right size", function () {
            assert.equal(100, rooms.length)
        })
    })

    describe("#getAllRoomsInRange()", function () {
        const startRooms = ["E30S30", "W10N5", "E5S23"]
        const rooms = u.getAllRoomsInRange(1, startRooms)
        it("should have 9 rooms per", function () {
            assert.equal(rooms.length, startRooms.length * 9)
        })

        it("should include corner cases", function () {
            const corners = ["E29S29", "W10N6", "E4S23", "E5S23"]
            const outers = ["E28S29", "W10N5", "E3S23"]

            _(corners).forEach(corner => assert(rooms.includes(corner)))
            _(outers).forEach(outer => assert(!rooms.includes(outer)))
        })
    })
})

describe("observer", function () {
    beforeEach(function() {
        Game.reset()
        Memory.reset()
    })

    var o = require("../src/observer.js")

    describe("#findRoomsForScan()", function () {
        it("should find 81 rooms", function () {
            const rN = "E0N0"
            const room = new Room(rN)
            new StructureController(room)
            o.findRoomsForScan()
            assert.equal(81, Cache.rooms[rN].scannerTargets.length)
        })
    })
})
