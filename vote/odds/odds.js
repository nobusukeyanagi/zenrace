(() => {
  "use strict";

  const ODDS_DATA = {"3連単":[{"rank":1,"cars":[1,3,4],"odds":6.1},{"rank":2,"cars":[1,3,5],"odds":12.4},{"rank":3,"cars":[1,3,2],"odds":12.4},{"rank":4,"cars":[1,4,3],"odds":12.8},{"rank":5,"cars":[1,2,3],"odds":16.9},{"rank":6,"cars":[3,1,4],"odds":18.0},{"rank":7,"cars":[1,4,5],"odds":27.3},{"rank":8,"cars":[1,3,6],"odds":27.5},{"rank":9,"cars":[3,1,2],"odds":29.1},{"rank":10,"cars":[3,4,1],"odds":31.3},{"rank":11,"cars":[1,5,3],"odds":32.5},{"rank":12,"cars":[1,2,4],"odds":34.2},{"rank":13,"cars":[3,1,5],"odds":34.5},{"rank":14,"cars":[2,1,3],"odds":38.6},{"rank":15,"cars":[1,5,4],"odds":41.8},{"rank":16,"cars":[1,3,7],"odds":45.3},{"rank":17,"cars":[1,4,2],"odds":47.1},{"rank":18,"cars":[3,4,5],"odds":55.6},{"rank":19,"cars":[3,2,1],"odds":58.1},{"rank":20,"cars":[2,3,1],"odds":58.6},{"rank":21,"cars":[4,1,3],"odds":59.6},{"rank":22,"cars":[4,3,1],"odds":60.3},{"rank":23,"cars":[3,1,6],"odds":64.8},{"rank":24,"cars":[1,4,6],"odds":69.8},{"rank":25,"cars":[1,2,5],"odds":70.2},{"rank":26,"cars":[2,1,4],"odds":81.8},{"rank":27,"cars":[3,5,1],"odds":90.7},{"rank":28,"cars":[1,4,7],"odds":92.8},{"rank":29,"cars":[3,4,2],"odds":95.3},{"rank":30,"cars":[1,6,3],"odds":101.4},{"rank":31,"cars":[1,5,2],"odds":107.8},{"rank":32,"cars":[1,2,6],"odds":108.2},{"rank":33,"cars":[3,5,4],"odds":108.4},{"rank":34,"cars":[2,3,4],"odds":116.4},{"rank":35,"cars":[3,2,4],"odds":116.8},{"rank":36,"cars":[3,4,6],"odds":117.7},{"rank":37,"cars":[3,1,7],"odds":118.7},{"rank":38,"cars":[1,5,6],"odds":120.9},{"rank":39,"cars":[4,3,5],"odds":126.7},{"rank":40,"cars":[4,1,5],"odds":134.2},{"rank":41,"cars":[5,1,3],"odds":139.0},{"rank":42,"cars":[3,4,7],"odds":158.2},{"rank":43,"cars":[5,3,1],"odds":162.2},{"rank":44,"cars":[1,6,4],"odds":168.1},{"rank":45,"cars":[4,1,2],"odds":175.8},{"rank":46,"cars":[1,3,8],"odds":178.8},{"rank":47,"cars":[2,1,5],"odds":180.6},{"rank":48,"cars":[1,7,3],"odds":182.3},{"rank":49,"cars":[4,3,2],"odds":187.0},{"rank":50,"cars":[1,2,7],"odds":195.6},{"rank":51,"cars":[2,4,1],"odds":196.2},{"rank":52,"cars":[5,1,4],"odds":199.9},{"rank":53,"cars":[4,5,1],"odds":204.7},{"rank":54,"cars":[4,5,3],"odds":206.9},{"rank":55,"cars":[1,5,7],"odds":209.8},{"rank":56,"cars":[1,6,5],"odds":209.8},{"rank":57,"cars":[2,4,3],"odds":213.0},{"rank":58,"cars":[5,3,4],"odds":217.3},{"rank":59,"cars":[1,7,4],"odds":219.3},{"rank":60,"cars":[2,1,6],"odds":223.8},{"rank":61,"cars":[3,6,1],"odds":224.8},{"rank":62,"cars":[3,2,5],"odds":241.0},{"rank":63,"cars":[1,6,2],"odds":251.9},{"rank":64,"cars":[2,3,5],"odds":258.1},{"rank":65,"cars":[4,3,6],"odds":264.8},{"rank":66,"cars":[5,4,3],"odds":274.1},{"rank":67,"cars":[5,4,1],"odds":276.8},{"rank":68,"cars":[3,2,6],"odds":292.1},{"rank":69,"cars":[3,5,6],"odds":292.4},{"rank":70,"cars":[4,1,6],"odds":299.1},{"rank":71,"cars":[3,5,2],"odds":308.0},{"rank":72,"cars":[2,3,6],"odds":316.0},{"rank":73,"cars":[1,7,5],"odds":319.5},{"rank":74,"cars":[4,3,7],"odds":321.1},{"rank":75,"cars":[4,2,1],"odds":324.6},{"rank":76,"cars":[4,2,3],"odds":326.9},{"rank":77,"cars":[3,6,4],"odds":327.7},{"rank":78,"cars":[4,1,7],"odds":386.2},{"rank":79,"cars":[5,1,2],"odds":403.1},{"rank":80,"cars":[6,1,3],"odds":405.4},{"rank":81,"cars":[3,1,8],"odds":406.3},{"rank":82,"cars":[1,4,8],"odds":410.9},{"rank":83,"cars":[3,7,1],"odds":431.6},{"rank":84,"cars":[3,5,7],"odds":436.3},{"rank":85,"cars":[6,3,1],"odds":442.5},{"rank":86,"cars":[1,7,2],"odds":461.5},{"rank":87,"cars":[3,6,5],"odds":464.7},{"rank":88,"cars":[2,1,7],"odds":465.8},{"rank":89,"cars":[3,7,4],"odds":472.1},{"rank":90,"cars":[1,2,8],"odds":480.5},{"rank":91,"cars":[5,1,6],"odds":514.1},{"rank":92,"cars":[3,2,7],"odds":524.1},{"rank":93,"cars":[2,5,1],"odds":528.0},{"rank":94,"cars":[4,5,6],"odds":528.5},{"rank":95,"cars":[1,6,7],"odds":537.4},{"rank":96,"cars":[2,3,7],"odds":537.8},{"rank":97,"cars":[1,7,6],"odds":549.0},{"rank":98,"cars":[2,4,5],"odds":552.8},{"rank":99,"cars":[2,5,3],"odds":558.9},{"rank":100,"cars":[5,3,2],"odds":577.0},{"rank":101,"cars":[3,6,2],"odds":581.7},{"rank":102,"cars":[1,5,8],"odds":618.4},{"rank":103,"cars":[5,3,6],"odds":629.4},{"rank":104,"cars":[2,4,6],"odds":646.8},{"rank":105,"cars":[3,4,8],"odds":655.2},{"rank":106,"cars":[6,1,4],"odds":709.2},{"rank":107,"cars":[4,6,1],"odds":714.2},{"rank":108,"cars":[4,6,3],"odds":722.7},{"rank":109,"cars":[2,4,7],"odds":729.2},{"rank":110,"cars":[4,5,2],"odds":743.1},{"rank":111,"cars":[6,3,4],"odds":752.3},{"rank":112,"cars":[5,2,1],"odds":757.4},{"rank":113,"cars":[3,7,5],"odds":759.8},{"rank":114,"cars":[4,2,5],"odds":791.0},{"rank":115,"cars":[2,6,1],"odds":803.6},{"rank":116,"cars":[6,1,2],"odds":817.1},{"rank":117,"cars":[2,5,4],"odds":835.7},{"rank":118,"cars":[4,5,7],"odds":842.1},{"rank":119,"cars":[2,1,8],"odds":855.1},{"rank":120,"cars":[5,4,6],"odds":863.6},{"rank":121,"cars":[2,6,3],"odds":900.2},{"rank":122,"cars":[6,1,5],"odds":902.8},{"rank":123,"cars":[5,2,3],"odds":932.7},{"rank":124,"cars":[3,6,7],"odds":934.1},{"rank":125,"cars":[5,1,7],"odds":942.8},{"rank":126,"cars":[1,6,8],"odds":954.0},{"rank":126,"cars":[4,6,5],"odds":954.0},{"rank":128,"cars":[3,7,6],"odds":960.8},{"rank":129,"cars":[3,7,2],"odds":962.3},{"rank":130,"cars":[5,4,2],"odds":971.5},{"rank":131,"cars":[5,6,1],"odds":974.6},{"rank":132,"cars":[2,3,8],"odds":984.1},{"rank":133,"cars":[1,7,8],"odds":1009.0},{"rank":134,"cars":[4,7,3],"odds":1012.0},{"rank":135,"cars":[4,7,1],"odds":1042.0},{"rank":136,"cars":[4,2,7],"odds":1047.0},{"rank":137,"cars":[4,1,8],"odds":1059.0},{"rank":138,"cars":[3,2,8],"odds":1075.0},{"rank":139,"cars":[5,3,7],"odds":1079.0},{"rank":140,"cars":[7,1,3],"odds":1088.0},{"rank":141,"cars":[1,8,3],"odds":1101.0},{"rank":142,"cars":[6,4,1],"odds":1108.0},{"rank":143,"cars":[6,4,3],"odds":1133.0},{"rank":144,"cars":[6,3,2],"odds":1138.0},{"rank":145,"cars":[6,3,5],"odds":1145.0},{"rank":146,"cars":[4,3,8],"odds":1148.0},{"rank":147,"cars":[7,3,1],"odds":1149.0},{"rank":148,"cars":[4,2,6],"odds":1167.0},{"rank":149,"cars":[3,5,8],"odds":1169.0},{"rank":150,"cars":[6,5,1],"odds":1235.0},{"rank":151,"cars":[5,4,7],"odds":1245.0},{"rank":151,"cars":[5,6,3],"odds":1245.0},{"rank":153,"cars":[5,2,4],"odds":1264.0},{"rank":154,"cars":[2,6,4],"odds":1274.0},{"rank":155,"cars":[6,2,1],"odds":1281.0},{"rank":156,"cars":[2,5,6],"odds":1336.0},{"rank":157,"cars":[5,6,4],"odds":1355.0},{"rank":157,"cars":[7,1,4],"odds":1355.0},{"rank":159,"cars":[6,2,3],"odds":1425.0},{"rank":160,"cars":[2,7,4],"odds":1436.0},{"rank":161,"cars":[7,3,4],"odds":1472.0},{"rank":162,"cars":[4,7,5],"odds":1474.0},{"rank":163,"cars":[1,8,4],"odds":1536.0},{"rank":164,"cars":[2,7,1],"odds":1541.0},{"rank":165,"cars":[4,6,2],"odds":1565.0},{"rank":166,"cars":[2,6,5],"odds":1590.0},{"rank":167,"cars":[1,8,2],"odds":1596.0},{"rank":168,"cars":[6,5,3],"odds":1605.0},{"rank":169,"cars":[3,8,1],"odds":1633.0},{"rank":170,"cars":[4,7,2],"odds":1662.0},{"rank":171,"cars":[6,4,5],"odds":1669.0},{"rank":172,"cars":[2,7,3],"odds":1678.0},{"rank":173,"cars":[6,5,4],"odds":1771.0},{"rank":174,"cars":[7,1,2],"odds":1781.0},{"rank":175,"cars":[7,4,3],"odds":1890.0},{"rank":176,"cars":[6,1,7],"odds":1899.0},{"rank":177,"cars":[7,4,1],"odds":1954.0},{"rank":178,"cars":[4,6,7],"odds":1960.0},{"rank":179,"cars":[1,8,7],"odds":2022.0},{"rank":180,"cars":[1,8,5],"odds":2029.0},{"rank":180,"cars":[3,6,8],"odds":2029.0},{"rank":182,"cars":[1,8,6],"odds":2032.0},{"rank":183,"cars":[5,1,8],"odds":2077.0},{"rank":184,"cars":[6,4,2],"odds":2085.0},{"rank":185,"cars":[5,2,6],"odds":2103.0},{"rank":186,"cars":[6,2,4],"odds":2128.0},{"rank":187,"cars":[4,5,8],"odds":2136.0},{"rank":188,"cars":[5,7,3],"odds":2198.0},{"rank":189,"cars":[2,4,8],"odds":2218.0},{"rank":190,"cars":[2,5,7],"odds":2238.0},{"rank":191,"cars":[3,7,8],"odds":2247.0},{"rank":191,"cars":[5,7,4],"odds":2247.0},{"rank":193,"cars":[7,1,5],"odds":2285.0},{"rank":194,"cars":[5,7,1],"odds":2293.0},{"rank":195,"cars":[7,2,3],"odds":2338.0},{"rank":196,"cars":[7,2,4],"odds":2351.0},{"rank":197,"cars":[7,3,5],"odds":2407.0},{"rank":198,"cars":[4,7,6],"odds":2426.0},{"rank":199,"cars":[7,2,1],"odds":2431.0},{"rank":200,"cars":[3,8,4],"odds":2517.0},{"rank":201,"cars":[7,3,2],"odds":2544.0},{"rank":202,"cars":[7,4,2],"odds":2649.0},{"rank":203,"cars":[5,6,2],"odds":2672.0},{"rank":204,"cars":[7,4,5],"odds":2690.0},{"rank":205,"cars":[5,3,8],"odds":2696.0},{"rank":206,"cars":[5,6,7],"odds":2841.0},{"rank":207,"cars":[4,6,8],"odds":2882.0},{"rank":208,"cars":[6,3,7],"odds":2889.0},{"rank":209,"cars":[2,6,7],"odds":2917.0},{"rank":210,"cars":[2,6,8],"odds":2924.0},{"rank":211,"cars":[8,1,3],"odds":2974.0},{"rank":212,"cars":[6,2,5],"odds":3003.0},{"rank":213,"cars":[6,5,2],"odds":3033.0},{"rank":214,"cars":[3,8,2],"odds":3064.0},{"rank":215,"cars":[2,7,6],"odds":3135.0},{"rank":215,"cars":[7,1,6],"odds":3135.0},{"rank":217,"cars":[5,4,8],"odds":3235.0},{"rank":218,"cars":[2,8,1],"odds":3253.0},{"rank":219,"cars":[4,2,8],"odds":3288.0},{"rank":220,"cars":[6,1,8],"odds":3306.0},{"rank":221,"cars":[2,7,5],"odds":3352.0},{"rank":222,"cars":[7,5,3],"odds":3361.0},{"rank":223,"cars":[7,5,4],"odds":3370.0},{"rank":224,"cars":[2,8,3],"odds":3497.0},{"rank":225,"cars":[7,3,6],"odds":3537.0},{"rank":226,"cars":[8,3,1],"odds":3569.0},{"rank":227,"cars":[8,1,2],"odds":3590.0},{"rank":228,"cars":[3,8,5],"odds":3622.0},{"rank":228,"cars":[5,2,7],"odds":3622.0},{"rank":230,"cars":[6,4,7],"odds":3699.0},{"rank":230,"cars":[7,5,1],"odds":3699.0},{"rank":232,"cars":[3,8,7],"odds":3733.0},{"rank":233,"cars":[3,8,6],"odds":3828.0},{"rank":234,"cars":[5,7,6],"odds":3840.0},{"rank":235,"cars":[2,5,8],"odds":4072.0},{"rank":235,"cars":[4,8,1],"odds":4072.0},{"rank":237,"cars":[6,2,7],"odds":4141.0},{"rank":238,"cars":[4,7,8],"odds":4198.0},{"rank":239,"cars":[6,7,1],"odds":4477.0},{"rank":240,"cars":[6,3,8],"odds":4527.0},{"rank":241,"cars":[7,4,6],"odds":4562.0},{"rank":242,"cars":[2,7,8],"odds":4614.0},{"rank":243,"cars":[5,6,8],"odds":4777.0},{"rank":244,"cars":[8,2,1],"odds":4815.0},{"rank":245,"cars":[4,8,3],"odds":4873.0},{"rank":245,"cars":[6,5,7],"odds":4873.0},{"rank":247,"cars":[6,7,4],"odds":4893.0},{"rank":248,"cars":[5,2,8],"odds":4932.0},{"rank":248,"cars":[5,7,2],"odds":4932.0},{"rank":250,"cars":[6,7,3],"odds":4953.0},{"rank":251,"cars":[7,3,8],"odds":4993.0},{"rank":252,"cars":[7,1,8],"odds":5299.0},{"rank":253,"cars":[7,6,1],"odds":5345.0},{"rank":254,"cars":[8,1,6],"odds":5417.0},{"rank":254,"cars":[8,3,2],"odds":5417.0},{"rank":256,"cars":[2,8,4],"odds":5441.0},{"rank":257,"cars":[8,2,3],"odds":5490.0},{"rank":258,"cars":[4,8,5],"odds":5566.0},{"rank":259,"cars":[7,6,3],"odds":5644.0},{"rank":260,"cars":[7,6,4],"odds":5948.0},{"rank":261,"cars":[6,7,8],"odds":5977.0},{"rank":262,"cars":[6,4,8],"odds":6007.0},{"rank":262,"cars":[6,8,1],"odds":6007.0},{"rank":264,"cars":[2,8,6],"odds":6097.0},{"rank":264,"cars":[7,2,5],"odds":6097.0},{"rank":266,"cars":[6,7,5],"odds":6320.0},{"rank":267,"cars":[7,5,6],"odds":6353.0},{"rank":268,"cars":[5,8,3],"odds":6420.0},{"rank":269,"cars":[8,1,4],"odds":6454.0},{"rank":270,"cars":[5,8,1],"odds":6595.0},{"rank":271,"cars":[2,8,7],"odds":6667.0},{"rank":271,"cars":[4,8,7],"odds":6667.0},{"rank":271,"cars":[6,7,2],"odds":6667.0},{"rank":274,"cars":[4,8,6],"odds":6704.0},{"rank":275,"cars":[4,8,2],"odds":6779.0},{"rank":276,"cars":[7,2,6],"odds":6934.0},{"rank":277,"cars":[7,6,5],"odds":6974.0},{"rank":277,"cars":[8,3,4],"odds":6974.0},{"rank":279,"cars":[7,8,1],"odds":7055.0},{"rank":280,"cars":[2,8,5],"odds":7096.0},{"rank":280,"cars":[8,6,1],"odds":7096.0},{"rank":282,"cars":[7,4,8],"odds":7138.0},{"rank":283,"cars":[5,7,8],"odds":7223.0},{"rank":284,"cars":[5,8,4],"odds":7490.0},{"rank":285,"cars":[8,4,1],"odds":7729.0},{"rank":286,"cars":[7,6,8],"odds":7778.0},{"rank":286,"cars":[7,8,3],"odds":7778.0},{"rank":286,"cars":[8,1,7],"odds":7778.0},{"rank":289,"cars":[7,5,2],"odds":7931.0},{"rank":290,"cars":[6,5,8],"odds":7983.0},{"rank":291,"cars":[8,4,3],"odds":8144.0},{"rank":292,"cars":[8,1,5],"odds":8311.0},{"rank":293,"cars":[8,3,5],"odds":8427.0},{"rank":294,"cars":[6,2,8],"odds":8606.0},{"rank":295,"cars":[5,8,7],"odds":8667.0},{"rank":296,"cars":[8,7,1],"odds":8793.0},{"rank":297,"cars":[7,6,2],"odds":8922.0},{"rank":297,"cars":[8,3,6],"odds":8922.0},{"rank":299,"cars":[8,2,5],"odds":8988.0},{"rank":300,"cars":[5,8,6],"odds":9055.0},{"rank":301,"cars":[5,8,2],"odds":9193.0},{"rank":301,"cars":[7,8,6],"odds":9193.0},{"rank":301,"cars":[8,7,6],"odds":9193.0},{"rank":304,"cars":[8,3,7],"odds":9263.0},{"rank":305,"cars":[7,8,4],"odds":9334.0},{"rank":306,"cars":[6,8,7],"odds":9630.0},{"rank":307,"cars":[6,8,3],"odds":9707.0},{"rank":307,"cars":[8,4,5],"odds":9707.0},{"rank":309,"cars":[7,2,8],"odds":9786.0},{"rank":310,"cars":[8,5,3],"odds":9946.0},{"rank":311,"cars":[8,2,4],"odds":10371.0},{"rank":312,"cars":[8,4,6],"odds":10461.0},{"rank":313,"cars":[8,6,3],"odds":10738.0},{"rank":314,"cars":[7,8,2],"odds":10834.0},{"rank":315,"cars":[6,8,4],"odds":11031.0},{"rank":316,"cars":[7,5,8],"odds":11132.0},{"rank":316,"cars":[8,5,4],"odds":11132.0},{"rank":316,"cars":[8,7,3],"odds":11132.0},{"rank":319,"cars":[8,5,2],"odds":11236.0},{"rank":320,"cars":[8,6,7],"odds":11341.0},{"rank":321,"cars":[8,4,2],"odds":11448.0},{"rank":322,"cars":[8,5,1],"odds":11557.0},{"rank":323,"cars":[7,8,5],"odds":11781.0},{"rank":324,"cars":[8,2,7],"odds":12134.0},{"rank":325,"cars":[6,8,2],"odds":12382.0},{"rank":325,"cars":[8,4,7],"odds":12382.0},{"rank":327,"cars":[6,8,5],"odds":13190.0},{"rank":328,"cars":[8,5,6],"odds":13335.0},{"rank":328,"cars":[8,6,2],"odds":13335.0},{"rank":330,"cars":[8,5,7],"odds":13634.0},{"rank":330,"cars":[8,7,2],"odds":13634.0},{"rank":332,"cars":[8,2,6],"odds":13948.0},{"rank":332,"cars":[8,7,4],"odds":13948.0},{"rank":334,"cars":[8,6,4],"odds":14276.0},{"rank":334,"cars":[8,7,5],"odds":14276.0},{"rank":336,"cars":[8,6,5],"odds":14446.0}],"3連複":[{"rank":1,"cars":[1,3,4],"odds":3.1},{"rank":2,"cars":[1,2,3],"odds":3.7},{"rank":3,"cars":[1,3,5],"odds":6.9},{"rank":4,"cars":[1,2,4],"odds":14.4},{"rank":5,"cars":[1,4,5],"odds":15.6},{"rank":6,"cars":[1,3,6],"odds":15.8},{"rank":7,"cars":[3,4,5],"odds":22.7},{"rank":8,"cars":[2,3,4],"odds":26.2},{"rank":9,"cars":[1,3,7],"odds":29.0},{"rank":10,"cars":[1,2,5],"odds":32.3},{"rank":11,"cars":[1,2,6],"odds":39.7},{"rank":12,"cars":[1,4,6],"odds":39.8},{"rank":13,"cars":[3,4,6],"odds":43.5},{"rank":14,"cars":[1,5,6],"odds":49.4},{"rank":15,"cars":[2,3,5],"odds":53.6},{"rank":16,"cars":[1,4,7],"odds":58.9},{"rank":17,"cars":[2,3,6],"odds":64.4},{"rank":18,"cars":[1,3,8],"odds":75.6},{"rank":19,"cars":[3,4,7],"odds":75.9},{"rank":20,"cars":[1,2,7],"odds":76.0},{"rank":21,"cars":[3,5,6],"odds":78.3},{"rank":22,"cars":[4,5,6],"odds":86.2},{"rank":23,"cars":[2,4,5],"odds":101.3},{"rank":24,"cars":[1,5,7],"odds":106.2},{"rank":25,"cars":[2,4,7],"odds":114.4},{"rank":26,"cars":[1,2,8],"odds":120.9},{"rank":27,"cars":[2,4,6],"odds":126.8},{"rank":28,"cars":[2,3,7],"odds":128.8},{"rank":29,"cars":[3,5,7],"odds":151.4},{"rank":30,"cars":[1,4,8],"odds":168.4},{"rank":31,"cars":[2,3,8],"odds":172.7},{"rank":32,"cars":[1,6,7],"odds":180.1},{"rank":33,"cars":[4,5,7],"odds":199.3},{"rank":34,"cars":[3,4,8],"odds":215.9},{"rank":35,"cars":[2,5,6],"odds":217.3},{"rank":36,"cars":[1,6,8],"odds":227.6},{"rank":37,"cars":[3,5,8],"odds":233.9},{"rank":38,"cars":[1,5,8],"odds":243.2},{"rank":39,"cars":[3,6,7],"odds":248.6},{"rank":40,"cars":[4,6,7],"odds":261.1},{"rank":41,"cars":[2,6,8],"odds":269.5},{"rank":42,"cars":[1,7,8],"odds":295.5},{"rank":43,"cars":[5,6,7],"odds":322.4},{"rank":44,"cars":[2,4,8],"odds":370.2},{"rank":45,"cars":[6,7,8],"odds":382.8},{"rank":46,"cars":[3,7,8],"odds":405.9},{"rank":47,"cars":[2,6,7],"odds":423.7},{"rank":48,"cars":[4,6,8],"odds":434.7},{"rank":49,"cars":[2,5,7],"odds":440.4},{"rank":50,"cars":[4,5,8],"odds":443.3},{"rank":51,"cars":[3,6,8],"odds":452.2},{"rank":52,"cars":[2,7,8],"odds":458.3},{"rank":53,"cars":[2,5,8],"odds":477.8},{"rank":54,"cars":[4,7,8],"odds":510.4},{"rank":55,"cars":[5,6,8],"odds":534.7},{"rank":56,"cars":[5,7,8],"odds":552.3}],"2連単":[{"rank":1,"cars":[1,3],"odds":3.1},{"rank":2,"cars":[1,4],"odds":6.8},{"rank":3,"cars":[3,1],"odds":7.5},{"rank":4,"cars":[1,2],"odds":8.8},{"rank":5,"cars":[1,5],"odds":13.2},{"rank":6,"cars":[3,4],"odds":13.6},{"rank":7,"cars":[3,2],"odds":21.9},{"rank":8,"cars":[2,1],"odds":23.0},{"rank":9,"cars":[4,1],"odds":25.9},{"rank":9,"cars":[4,3],"odds":25.9},{"rank":11,"cars":[2,3],"odds":26.9},{"rank":12,"cars":[3,5],"odds":27.4},{"rank":13,"cars":[1,6],"odds":31.4},{"rank":14,"cars":[5,1],"odds":46.6},{"rank":15,"cars":[2,4],"odds":47.7},{"rank":16,"cars":[3,6],"odds":48.7},{"rank":17,"cars":[5,3],"odds":53.9},{"rank":18,"cars":[1,7],"odds":59.3},{"rank":19,"cars":[4,5],"odds":62.0},{"rank":20,"cars":[4,2],"odds":72.9},{"rank":21,"cars":[3,7],"odds":72.9},{"rank":22,"cars":[5,4],"odds":77.9},{"rank":23,"cars":[6,1],"odds":97.8},{"rank":24,"cars":[2,5],"odds":105.0},{"rank":25,"cars":[5,2],"odds":108.7},{"rank":26,"cars":[4,6],"odds":122.8},{"rank":27,"cars":[6,3],"odds":132.3},{"rank":28,"cars":[2,6],"odds":138.2},{"rank":29,"cars":[5,6],"odds":152.3},{"rank":30,"cars":[3,8],"odds":156.6},{"rank":31,"cars":[4,7],"odds":164.5},{"rank":32,"cars":[2,7],"odds":184.9},{"rank":33,"cars":[6,5],"odds":195.4},{"rank":34,"cars":[6,4],"odds":196.0},{"rank":35,"cars":[7,1],"odds":205.5},{"rank":36,"cars":[1,8],"odds":214.1},{"rank":37,"cars":[6,2],"odds":220.0},{"rank":38,"cars":[7,3],"odds":256.2},{"rank":39,"cars":[5,7],"odds":260.9},{"rank":40,"cars":[7,2],"odds":291.6},{"rank":41,"cars":[7,4],"odds":302.7},{"rank":42,"cars":[4,8],"odds":349.9},{"rank":43,"cars":[2,8],"odds":364.2},{"rank":44,"cars":[8,1],"odds":369.8},{"rank":45,"cars":[7,5],"odds":398.5},{"rank":46,"cars":[8,3],"odds":403.0},{"rank":47,"cars":[5,8],"odds":456.9},{"rank":48,"cars":[6,7],"odds":459.9},{"rank":49,"cars":[8,2],"odds":478.3},{"rank":50,"cars":[7,6],"odds":516.1},{"rank":51,"cars":[8,4],"odds":535.4},{"rank":52,"cars":[7,8],"odds":578.6},{"rank":53,"cars":[8,7],"odds":597.8},{"rank":54,"cars":[8,5],"odds":602.9},{"rank":55,"cars":[8,6],"odds":703.4},{"rank":56,"cars":[6,8],"odds":739.6}],"2連複":[{"rank":1,"cars":[1,3],"odds":2.0},{"rank":2,"cars":[1,2],"odds":5.6},{"rank":3,"cars":[1,4],"odds":6.4},{"rank":4,"cars":[3,4],"odds":7.3},{"rank":5,"cars":[1,5],"odds":10.1},{"rank":6,"cars":[2,3],"odds":13.1},{"rank":7,"cars":[3,5],"odds":22.7},{"rank":8,"cars":[1,6],"odds":28.1},{"rank":9,"cars":[2,4],"odds":36.7},{"rank":10,"cars":[4,5],"odds":39.1},{"rank":11,"cars":[3,6],"odds":47.7},{"rank":12,"cars":[1,7],"odds":52.8},{"rank":13,"cars":[2,5],"odds":69.1},{"rank":14,"cars":[3,7],"odds":78.9},{"rank":15,"cars":[4,6],"odds":79.6},{"rank":16,"cars":[5,6],"odds":91.1},{"rank":17,"cars":[1,8],"odds":92.0},{"rank":18,"cars":[2,6],"odds":102.5},{"rank":19,"cars":[2,7],"odds":105.4},{"rank":20,"cars":[3,8],"odds":111.7},{"rank":21,"cars":[4,7],"odds":135.8},{"rank":22,"cars":[2,8],"odds":164.1},{"rank":23,"cars":[5,7],"odds":185.0},{"rank":24,"cars":[6,7],"odds":216.9},{"rank":25,"cars":[4,8],"odds":262.1},{"rank":26,"cars":[6,8],"odds":265.8},{"rank":27,"cars":[7,8],"odds":309.4},{"rank":28,"cars":[5,8],"odds":385.2}],"ワイド":[{"rank":1,"cars":[1,3],"odds":[1.1,1.2]},{"rank":2,"cars":[1,4],"odds":[1.8,2.6]},{"rank":3,"cars":[3,4],"odds":[1.9,2.8]},{"rank":4,"cars":[1,2],"odds":[2.2,2.9]},{"rank":5,"cars":[1,5],"odds":[2.9,3.9]},{"rank":6,"cars":[2,3],"odds":[3.5,5.2]},{"rank":7,"cars":[3,5],"odds":[4.1,5.9]},{"rank":8,"cars":[1,6],"odds":[5.5,7.6]},{"rank":9,"cars":[3,6],"odds":[6.2,8.6]},{"rank":10,"cars":[4,5],"odds":[7.7,9.2]},{"rank":11,"cars":[2,4],"odds":[7.7,9.3]},{"rank":12,"cars":[3,7],"odds":[9.8,13.4]},{"rank":13,"cars":[1,7],"odds":[10.0,13.8]},{"rank":14,"cars":[2,5],"odds":[12.1,14.1]},{"rank":15,"cars":[3,8],"odds":[12.7,17.3]},{"rank":16,"cars":[2,7],"odds":[16.9,18.7]},{"rank":16,"cars":[4,6],"odds":[16.4,18.7]},{"rank":18,"cars":[1,8],"odds":[14.9,20.3]},{"rank":19,"cars":[4,7],"odds":[21.0,23.6]},{"rank":20,"cars":[5,6],"odds":[23.2,25.3]},{"rank":21,"cars":[2,6],"odds":[25.7,28.8]},{"rank":22,"cars":[2,8],"odds":[27.8,30.5]},{"rank":23,"cars":[4,8],"odds":[32.2,35.9]},{"rank":24,"cars":[6,8],"odds":[39.8,41.2]},{"rank":25,"cars":[6,7],"odds":[40.3,42.0]},{"rank":26,"cars":[5,7],"odds":[40.6,43.9]},{"rank":27,"cars":[5,8],"odds":[50.7,54.4]},{"rank":28,"cars":[7,8],"odds":[67.7,69.2]}]};
  const CARS = [1,2,3,4,5,6,7,8];
  const RIDERS = {
    1:"黒川 京介",2:"鈴木 圭一郎",3:"青山 周平",4:"金子 大輔",
    5:"長田 稚也",6:"佐藤 励",7:"鈴木 宏和",8:"佐藤 摩弥"
  };
  const SHORT_RIDERS = {1:"黒川",2:"鈴木圭",3:"青山",4:"金子",5:"長田",6:"佐藤励",7:"鈴木宏",8:"佐藤摩"};
  const TYPE_STORAGE_KEY = "zenrace.odds.type";
  const VALID_TYPES = ["3連単","3連複","2連単","2連複","ワイド","単勝"];
  const state = {
    type:"3連単",
    popularPage:0,
    trifectaPosition:1,
    trifectaCar:1,
    anchors:{"3連複":1}
  };

  const tabs = Array.from(document.querySelectorAll(".odds-type-tab"));
  const popularList = document.getElementById("popular-list");
  const popularViewport = document.getElementById("popular-viewport");
  const popularPrev = document.getElementById("popular-prev");
  const popularNext = document.getElementById("popular-next");
  const board = document.getElementById("odds-board");
  const anchor = document.getElementById("odds-anchor");

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
  }

  function carBadge(car) {
    return `<span class="entry-no entry-${car} odds-car-badge" aria-label="${car}号車">${car}</span>`;
  }

  function columnHeader(car) {
    return `<span class="odds-column-label"><strong>${car}</strong><small>${SHORT_RIDERS[car]}</small></span>`;
  }

  function formatOdds(value) {
    if (value === null || value === undefined || value === "") return "－";
    const number = Number(value);
    if (!Number.isFinite(number)) return "－";
    if (number >= 1000) return String(Math.round(number));
    return number.toFixed(1);
  }

  function combinationHtml(type, cars) {
    return cars.map(car => carBadge(car)).join("");
  }

  function oddsText(type, item) {
    if (type === "ワイド") return `${formatOdds(item.odds[0])}〜${formatOdds(item.odds[1])}`;
    return formatOdds(item.odds);
  }

  function popularPageCount(records) {
    return Math.max(1, Math.ceil(records.length / 10));
  }

  function normalizePopularPage(records) {
    const count = popularPageCount(records);
    state.popularPage = ((state.popularPage % count) + count) % count;
    return count;
  }

  function renderPopular() {
    const records = ODDS_DATA[state.type] || [];
    const hasRecords = records.length > 0;
    popularPrev.disabled = !hasRecords;
    popularNext.disabled = !hasRecords;
    popularPrev.setAttribute("aria-disabled", String(!hasRecords));
    popularNext.setAttribute("aria-disabled", String(!hasRecords));

    if (!hasRecords) {
      state.popularPage = 0;
      popularList.innerHTML = '<div class="odds-empty-message">添付データに単勝オッズが収録されていないため、表示できません。</div>';
      return;
    }

    const pageCount = normalizePopularPage(records);
    const start = state.popularPage * 10;
    const pageRecords = records.slice(start, start + 10);
    popularList.innerHTML = pageRecords.map(item => `
      <div class="odds-popular-row rank-${Math.min(Number(item.rank) || 4,4)}">
        <span class="odds-popular-rank">${item.rank}</span>
        <span class="odds-popular-combination">${combinationHtml(state.type,item.cars)}</span>
        <strong class="odds-popular-value">${oddsText(state.type,item)}</strong>
      </div>`).join("");
    popularList.setAttribute("aria-label", `${start + 1}位から${Math.min(start + 10, records.length)}位、全${records.length}件中`);
    popularPrev.setAttribute("aria-label", `前の人気順を表示（${state.popularPage + 1}/${pageCount}）`);
    popularNext.setAttribute("aria-label", `次の人気順を表示（${state.popularPage + 1}/${pageCount}）`);
  }

  function movePopularPage(delta) {
    const records = ODDS_DATA[state.type] || [];
    if (!records.length) return;
    state.popularPage += delta;
    normalizePopularPage(records);
    renderPopular();
  }

  function createLookup(type) {
    const map = new Map();
    const records = ODDS_DATA[type] || [];
    records.forEach(item => {
      let cars = item.cars.slice();
      if (type === "3連複" || type === "2連複" || type === "ワイド") cars.sort((a,b)=>a-b);
      map.set(cars.join("-"), item.odds);
    });
    return map;
  }

  function oddsClass(value) {
    const base = Array.isArray(value) ? Number(value[0]) : Number(value);
    if (!Number.isFinite(base)) return "";
    if (base <= 10) return " is-very-low";
    if (base <= 30) return " is-low";
    return "";
  }

  function matrixCell(content, className="") {
    return `<div class="odds-matrix-cell${className}">${content}</div>`;
  }

  function renderAnchor(type) {
    if (type !== "3連複") {
      anchor.hidden = true;
      anchor.innerHTML = "";
      return;
    }
    anchor.hidden = false;
    const selected = state.anchors[type];
    anchor.innerHTML = `<span class="odds-anchor-label">軸車</span>` + CARS.map(car => `
      <button type="button" class="odds-anchor-button${car===selected?" active":""}" data-anchor-car="${car}" aria-label="軸車 ${car}号車" aria-pressed="${car===selected}">${carBadge(car)}</button>`).join("");
    anchor.querySelectorAll("[data-anchor-car]").forEach(button => {
      button.addEventListener("click", () => {
        state.anchors[type] = Number(button.dataset.anchorCar);
        renderBoard();
      });
    });
  }

  function trifectaOrder() {
    const fixed = state.trifectaPosition;
    if (fixed === 1) return {column:2,row:3};
    if (fixed === 2) return {column:1,row:3};
    return {column:1,row:2};
  }

  function trifectaKey(columnCar,rowCar) {
    const order = trifectaOrder();
    const cars = [];
    cars[state.trifectaPosition - 1] = state.trifectaCar;
    cars[order.column - 1] = columnCar;
    cars[order.row - 1] = rowCar;
    return cars.join("-");
  }

  function trifectaCell(content,className="") {
    return `<div class="odds-trifecta-cell${className}">${content}</div>`;
  }

  function renderTrifecta() {
    const lookup = createLookup("3連単");
    const fixedCar = state.trifectaCar;
    const order = trifectaOrder();
    const candidates = CARS.filter(car => car !== fixedCar);

    let html = `
      <div class="odds-axis-controls">
        <label class="odds-axis-select-wrap">
          <select class="odds-axis-select" id="trifecta-position" aria-label="固定する着順">
            ${[1,2,3].map(position => `<option value="${position}"${position===state.trifectaPosition?" selected":""}>${position}着</option>`).join("")}
          </select>
        </label>
        <label class="odds-axis-select-wrap">
          <select class="odds-axis-select" id="trifecta-car" aria-label="固定する選手">
            ${CARS.map(car => `<option value="${car}"${car===fixedCar?" selected":""}>${car} ${escapeHtml(RIDERS[car])}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="odds-trifecta-grid">
        ${trifectaCell(`${order.column}着`," odds-trifecta-axis-label odds-trifecta-column-label")}
        ${candidates.map(car => trifectaCell(String(car),` odds-trifecta-car-cell entry-${car}`)).join("")}
        ${trifectaCell(`${order.row}着`," odds-trifecta-row-axis")}
    `;

    candidates.forEach(rowCar => {
      html += trifectaCell(String(rowCar),` odds-trifecta-car-cell entry-${rowCar}`);
      candidates.forEach(columnCar => {
        if (rowCar === columnCar) {
          html += trifectaCell(""," is-invalid");
          return;
        }
        const value = lookup.get(trifectaKey(columnCar,rowCar));
        html += trifectaCell(formatOdds(value),` odds-trifecta-value${oddsClass(value)}`);
      });
    });
    html += "</div>";
    board.innerHTML = html;

    document.getElementById("trifecta-position").addEventListener("change", event => {
      state.trifectaPosition = Number(event.target.value);
      renderTrifecta();
    });
    document.getElementById("trifecta-car").addEventListener("change", event => {
      state.trifectaCar = Number(event.target.value);
      renderTrifecta();
    });
  }

  function renderTrio() {
    const lookup = createLookup("3連複");
    const fixed = state.anchors["3連複"];
    const candidates = CARS.filter(car => car !== fixed);
    let html = '<div class="odds-matrix matrix-8">';
    html += matrixCell("相手車"," odds-matrix-corner");
    candidates.forEach(car => { html += matrixCell(columnHeader(car),` odds-matrix-head odds-car-cell entry-${car}`); });
    candidates.forEach((rowCar,rowIndex) => {
      html += matrixCell(String(rowCar),` odds-matrix-row-head odds-car-cell entry-${rowCar}`);
      candidates.forEach((colCar,colIndex) => {
        if (colIndex <= rowIndex) { html += matrixCell(""," is-invalid"); return; }
        const key = [fixed,rowCar,colCar].sort((a,b)=>a-b).join("-");
        const value = lookup.get(key);
        html += matrixCell(formatOdds(value),` odds-value-cell${oddsClass(value)}`);
      });
    });
    html += "</div>";
    board.innerHTML = html;
  }

  function renderExacta() {
    const lookup = createLookup("2連単");
    let html = '<div class="odds-matrix matrix-9">';
    html += matrixCell("1着＼2着"," odds-matrix-corner");
    CARS.forEach(car => { html += matrixCell(columnHeader(car),` odds-matrix-head odds-car-cell entry-${car}`); });
    CARS.forEach(first => {
      html += matrixCell(String(first),` odds-matrix-row-head odds-car-cell entry-${first}`);
      CARS.forEach(second => {
        if (first === second) { html += matrixCell(""," is-invalid"); return; }
        const value = lookup.get(`${first}-${second}`);
        html += matrixCell(formatOdds(value),` odds-value-cell${oddsClass(value)}`);
      });
    });
    html += "</div>";
    board.innerHTML = html;
  }

  function renderPair(type) {
    const lookup = createLookup(type);
    let html = '<div class="odds-matrix matrix-9">';
    html += matrixCell("車番"," odds-matrix-corner");
    CARS.forEach(car => { html += matrixCell(columnHeader(car),` odds-matrix-head odds-car-cell entry-${car}`); });
    CARS.forEach((rowCar,rowIndex) => {
      html += matrixCell(String(rowCar),` odds-matrix-row-head odds-car-cell entry-${rowCar}`);
      CARS.forEach((colCar,colIndex) => {
        if (colIndex <= rowIndex) { html += matrixCell(""," is-invalid"); return; }
        const value = lookup.get([rowCar,colCar].sort((a,b)=>a-b).join("-"));
        if (type === "ワイド" && Array.isArray(value)) {
          const content = `<span class="odds-wide-value"><span>${formatOdds(value[0])}</span><small>〜${formatOdds(value[1])}</small></span>`;
          html += matrixCell(content,` odds-value-cell${oddsClass(value)}`);
        } else {
          html += matrixCell(formatOdds(value),` odds-value-cell${oddsClass(value)}`);
        }
      });
    });
    html += "</div>";
    board.innerHTML = html;
  }

  function renderSingle() {
    let html = '<div class="odds-single-list">';
    html += '<div class="odds-single-cell odds-single-head">車番</div><div class="odds-single-cell odds-single-head">選手</div><div class="odds-single-cell odds-single-head">オッズ</div>';
    CARS.forEach(car => {
      html += `<div class="odds-single-cell odds-single-car entry-${car}">${car}</div><div class="odds-single-cell odds-single-name">${escapeHtml(RIDERS[car])}</div><div class="odds-single-cell odds-single-odds">－</div>`;
    });
    html += '<div class="odds-single-note">添付の「全日本選抜オートレース_オッズ整理.xlsx」には単勝データが含まれていません。</div></div>';
    board.innerHTML = html;
  }

  function renderBoard() {
    renderAnchor(state.type);
    if (state.type === "3連単") renderTrifecta();
    else if (state.type === "3連複") renderTrio();
    else if (state.type === "2連単") renderExacta();
    else if (state.type === "2連複" || state.type === "ワイド") renderPair(state.type);
    else renderSingle();
  }

  function setType(type, persist=true) {
    if (!VALID_TYPES.includes(type)) type = "3連単";
    const typeChanged = state.type !== type;
    state.type = type;
    if (typeChanged) state.popularPage = 0;
    tabs.forEach(tab => {
      const active = tab.dataset.oddsType === type;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-pressed", String(active));
    });
    if (persist) {
      try { sessionStorage.setItem(TYPE_STORAGE_KEY,type); } catch (_) {}
    }
    renderPopular();
    renderBoard();
  }

  popularPrev.addEventListener("click", () => movePopularPage(-1));
  popularNext.addEventListener("click", () => movePopularPage(1));

  let swipeStartX = null;
  let swipeStartY = null;
  popularViewport.addEventListener("touchstart", event => {
    const touch = event.changedTouches[0];
    swipeStartX = touch.clientX;
    swipeStartY = touch.clientY;
  }, {passive:true});
  popularViewport.addEventListener("touchend", event => {
    if (swipeStartX === null || swipeStartY === null) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - swipeStartX;
    const deltaY = touch.clientY - swipeStartY;
    swipeStartX = null;
    swipeStartY = null;
    if (Math.abs(deltaX) < 35 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    movePopularPage(deltaX < 0 ? 1 : -1);
  }, {passive:true});

  tabs.forEach(tab => tab.addEventListener("click", () => setType(tab.dataset.oddsType)));
  let initial = "3連単";
  try { initial = sessionStorage.getItem(TYPE_STORAGE_KEY) || initial; } catch (_) {}
  setType(initial,false);
})();
