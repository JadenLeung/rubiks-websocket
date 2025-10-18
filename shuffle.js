const { plls } = require("./PLL.js");
const { olls } = require("./OLL.js");

function shuffleCube(type, shufflenum, nowide = false) { 
    let arr = [];
    console.log("shuffling");
    let possible = ["R", "L", "U", "D", "B", "F", "Rw", "Lw", "Uw", "Dw", "Bw", "Fw"];
    if (nowide) {
        possible = ["R", "L", "U", "D", "B", "F"];
    }
    let bad5 = ['L','R','F','B','S','M','l','r','f','b'];
    let doubly = false;
    if (type == "Last Layer") {
        return randomLL();
    }

    if (type == "Middle Slices")
        possible = ["E", "M", "S"];
    else if (type == "MS") 
        possible = ["M", "S"];
    else if (type == "Cube Bandage") 
        possible = ["B", "R", "D"];
    else if (type == "Slice Bandage") 
        possible = ["B", "E", "D"];
    else if(type == "Double Turns")
        doubly = true;

    let s = shufflenum;

    let total = "";
    let prevrandom = "";
    for (let i = 0; i < s; i++) {
        let rnd = possible[Math.floor(Math.random() * possible.length)];
        let rnd2 = Math.random();
        const opposite = {
            L: "R", R: "L", F: "B", B: "F", U: "D", D: "U"
        };
        if (rnd[0].toUpperCase() == prevrandom || rnd[0].toUpperCase() == opposite[prevrandom]) {
            i--;
            continue;
        }
        prevrandom = rnd[0].toUpperCase()
        if(type == "Gearcube") {
            rnd = rnd.replace(/w/g, '');
                            if(rnd2 < 0.5){
                                    arr.push((rnd + "w"));
                                    arr.push(rnd);
                                    total += rnd + "w " + rnd + " ";
                            }
                            else{
                                    arr.push((rnd + "w'"));
                                    arr.push((rnd+"'"));
                                    total += rnd + "w' " + rnd + "' ";
                            }
        } else if (doubly || ((type == "3x3x2" || type == "2x3x4") && bad5.includes(rnd[0])) || ((type == "2x2x4" || type == "2x3x4") && i < 15)) {
            total += rnd + "2 ";
        } else if (rnd2 < 0.25) {
            total += rnd + " ";
        } else if (rnd2 < 0.75) {
            total += rnd + "2 ";
        } else {
            total += rnd + "' ";
        }
    }
    return total;
}

function getShuffle(cubearr, shufflearr = false) {
    const typemap = {"2x2x3" : "3x3x2", "2x2x4" : "2x2x4", "3x3x2": "3x3x2", "3x3x4" : "3x3x2", 
        "3x3x5" : "2x2x4", "1x4x4" : "3x3x2", "1x2x3" : "3x3x2", "Plus Cube": "Middle Slices", "2x3x4" : "2x3x4", "2x3x5" : "2x3x4",
        "1x5x5" : "3x3x2", "1x2x2" : "3x3x2", "3x3x2 Plus Cube" : "3x3x2", "Snake Eyes": "MS", "Cube Bandage" : "Cube Bandage",
        "Slice Bandage" : "Slice Bandage"};
    const shufflenum = {"2x2x4" : 45, "2x3x4" : 45, "2x3x5" : 45, "3x3x5" : 45, "5x5" : 45, "3x3x4" : 30, "1x4x4" : 30, "4x4" : 30, "1x5x5" : 30,
        "Earth Cube" : 30, "4x4 Plus Cube" : 30
    };
    let shufflea = typemap[cubearr[0]] ?? "Normal";
    let shuffleb = typemap[cubearr[1]] ?? "Normal";
    console.log("BEFORE", shufflea, shuffleb, shufflearr);
    if (shufflearr) {
        if (cubearr.length == 1) {
            shufflea = shufflearr == "Default" ? shufflea : shufflearr;
        } else {
            shufflea = shufflearr[0] == "Default" ? shufflea : shufflearr[0];
            shuffleb = shufflearr[1] == "Default" ? shuffleb : shufflearr[1];
        }
    }
    console.log("AFTER", shufflea, shuffleb);
    if (cubearr.length == 1 || shufflea == shuffleb) {
        if (shufflea == shuffleb) {
            return shuffleCube(shufflea, Math.max(shufflenum[cubearr[0]] ?? 18, shufflenum[cubearr[1]] ?? 18));
        }
        return shuffleCube(shufflea, shufflenum[cubearr[0]] ?? 18);
    } else {
        return false;
    }
}

function randomLL()
{
	const rndPLL = Object.keys(plls)[Math.floor(Math.random() * Object.keys(plls).length)]
    const rndOLL = Object.keys(olls)[Math.floor(Math.random() * Object.keys(olls).length)]
	let auf = "";
    let rnd3 = Math.floor(Math.random() * 4);
	for(let i = 0; i < rnd3; i++)
	{
		auf += "U ";
	}
	
    return (InverseAll(plls[rndPLL][0]) + " " + auf + InverseAll(olls[rndOLL][0]));
}

function InverseAll(str) {
	let newarr = []
	str.split(' ').forEach((c) => {
		newarr.push(Inverse(c))
	})
	return newarr.reverse().join(" ");
}

function Inverse(bad){
	if(bad.slice(-1) == "'")
	{
		bad = bad.substring(0, bad.length-1);
	}
	else
	{
		bad = bad + "'";
	}
	return bad;
}

module.exports = { shuffleCube, getShuffle, randomLL };