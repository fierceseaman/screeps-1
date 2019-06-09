var a = require('actions');
var t = require('types');
var u = require('utils');

var rSB = {
    name: "spawnBuilder",
    type: "spawnBuilder",
    target: () => 0,

    /** @param {Creep} creep **/
    run: function(creep) {
        var city = creep.memory.city;
        if (creep.hits < creep.hitsMax){
            creep.moveTo(Game.spawns[city])
            return;
        }
        if (Game.flags.claimRally && !creep.memory.rally){
            creep.moveTo(Game.flags.claimRally, {reusePath: 50})
            if (Game.flags.claimRally.pos.x == creep.pos.x && Game.flags.claimRally.pos.y == creep.pos.y && Game.flags.claimRally.pos.roomName == creep.pos.roomName){
                creep.memory.rally = true
            }
            return;
        }
        if(creep.pos.roomName === Game.flags.claim.pos.roomName){
            if(creep.carry.energy == 0 && creep.memory.building){
                creep.memory.building = false;
            }
            if(creep.carry.energy == creep.carryCapacity && !creep.memory.building) {
                creep.memory.building = true;
            }
            if (creep.memory.building){
                rSB.build(creep)
            } else {
                rSB.harvest(creep)
            }
        } else {
            creep.moveTo(Game.flags.claim.pos, {reusePath: 50});
        }
    },
    
    build: function(creep) {
        var targets = creep.room.find(FIND_CONSTRUCTION_SITES);
        var spawns = _.filter(targets, site => site.structureType == STRUCTURE_SPAWN);
      if(targets.length) {
        var target = targets[0];
        if (spawns.length){
            target = spawns[0];
        }
        if(creep.build(target) == ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {reusePath: 15});
        }
      } else {
        if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
            creep.moveTo(creep.room.controller, {reusePath: 15});  
        }
      }
    },
    
    harvest: function(creep) {
        var sources =  creep.room.find(FIND_SOURCES);
        if(creep.harvest(sources[creep.memory.target]) == ERR_NOT_IN_RANGE) {
            creep.moveTo(sources[creep.memory.target], {reusePath: 15});
        } else if (creep.harvest(sources[creep.memory.target]) == ERR_NOT_ENOUGH_RESOURCES){
            creep.memory.target = (creep.memory.target + 1) % 2;
        }
    }
};
module.exports = rSB;