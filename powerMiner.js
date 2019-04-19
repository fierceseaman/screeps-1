var a = require('actions');
var t = require('types');
var u = require('utils');

var rPM = {
    name: "powerMiner",
    type: "powerMiner",
    target: () => 0,
   

    /** @param {Creep} creep **/
    run: function(creep) {
        var breakerTarget = Game.getObjectById(creep.memory.target)
        if (Game.time % 50 == 1 && breakerTarget){
            if (breakerTarget.hits < 500000){
        		Game.spawns[creep.memory.city].memory.runner = Math.ceil(breakerTarget.power/1600);
        	}
        }
		if (breakerTarget && creep.pos.isNearTo(breakerTarget.pos)){
		    return a.attack(creep, breakerTarget);
		} 
    	if (!creep.memory.medic){
    		creep.memory.medic = null;
    	}
    	var medic = Game.getObjectById(creep.memory.medic);
    	if (medic){
    		if ((!creep.pos.isNearTo(medic.pos) && !(creep.pos.x == 0 || creep.pos.x == 49 || creep.pos.y == 0 || creep.pos.y == 49)) || (medic.fatigue > 0)){
    			return;
    		}
    	} else {
    		//look for medics
    		var allCreeps = u.splitCreepsByCity();
    		var medicSearch = _.find(allCreeps[creep.memory.city], localCreep => localCreep.memory.role === 'medic' && localCreep.pos.isNearTo(creep.pos) 
    		                                                                        && localCreep.memory.breaker == creep.id);
    		if (medicSearch){
    			creep.memory.medic = medicSearch.id;
    		}
    		return;
    	}
        var targetFlag = creep.memory.city + 'powerMine';
        if(Game.flags[targetFlag] && creep.pos.roomName === Game.flags[targetFlag].pos.roomName){
            var found = Game.flags[targetFlag].pos.lookFor(LOOK_STRUCTURES)
            if(found.length){
                a.attack(creep, found[0])
                creep.memory.target = found[0].id;
                return;
            }
            if (creep.pos.inRangeTo(Game.flags[targetFlag].pos, 10)){
                creep.moveTo(Game.spawns[creep.memory.city])
            }
            let resource = Game.flags[targetFlag].room.lookForAt(LOOK_RESOURCES, Game.flags[targetFlag].pos);
            if (!resource.length){
            	Game.flags[targetFlag].remove();
            }
        } else if(Game.flags[targetFlag]){
            creep.moveTo(Game.flags[targetFlag], {reusePath: 50})
            return;
        }
    }
};
module.exports = rPM;