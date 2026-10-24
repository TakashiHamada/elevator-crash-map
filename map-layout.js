// 生成画像を原寸で読み取り登録した座標。画像を差し替える場合は建物・歩道の位置も採り直してください。
export const MAP_LAYOUT = {
  // 配信用のWebP（npm run build:map-image で sourceImage から生成）。座標と指紋の基準は sourceImage のPNG。
  "image": "assets/misuta-realistic-map.webp",
  "sourceImage": "assets/misuta-realistic-map.png",
  "width": 1536,
  "height": 1024,
  "imageSha256": "2e7406f52d20f5f24c842badc851c0c7309ace73442d5d7ad7a928e60a58e6b9",
  "buildings": {
    "central": {
      "x": 782,
      "y": 507,
      "width": 23,
      "height": 20,
      "box": [
        771,
        497,
        794,
        517
      ],
      "prominent": false
    },
    "sunheights": {
      "x": 480,
      "y": 625,
      "width": 20,
      "height": 11,
      "box": [
        471,
        620,
        491,
        631
      ],
      "prominent": false
    },
    "station": {
      "x": 693,
      "y": 453,
      "width": 21,
      "height": 40,
      "box": [
        685,
        433,
        706,
        473
      ],
      "prominent": true
    },
    "station-north": {
      "x": 790,
      "y": 330,
      "width": 44,
      "height": 45,
      "box": [
        767,
        306,
        811,
        351
      ],
      "prominent": true
    },
    "warehouse": {
      "x": 1428,
      "y": 395,
      "width": 56,
      "height": 68,
      "box": [
        1401,
        365,
        1457,
        433
      ],
      "prominent": false
    },
    "housing": {
      "x": 677,
      "y": 80,
      "width": 33,
      "height": 12,
      "box": [
        662,
        75,
        695,
        87
      ],
      "prominent": false
    },
    "library": {
      "x": 563,
      "y": 126,
      "width": 37,
      "height": 23,
      "box": [
        547,
        112,
        584,
        135
      ],
      "prominent": true
    },
    "medical": {
      "x": 1001,
      "y": 391,
      "width": 19,
      "height": 31,
      "box": [
        992,
        375,
        1011,
        406
      ],
      "prominent": false
    },
    "shopping": {
      "x": 149,
      "y": 422,
      "width": 29,
      "height": 22,
      "box": [
        136,
        413,
        165,
        435
      ],
      "prominent": true
    },
    "hall": {
      "x": 837,
      "y": 471,
      "width": 11,
      "height": 10,
      "box": [
        833,
        466,
        844,
        476
      ],
      "prominent": false
    },
    "residence": {
      "x": 519,
      "y": 252,
      "width": 21,
      "height": 20,
      "box": [
        510,
        241,
        531,
        261
      ],
      "prominent": false
    },
    "south": {
      "x": 682,
      "y": 772,
      "width": 18,
      "height": 24,
      "box": [
        673,
        760,
        691,
        784
      ],
      "prominent": false
    },
    "west-heights": {
      "x": 293,
      "y": 415,
      "width": 16,
      "height": 9,
      "box": [
        286,
        411,
        302,
        420
      ],
      "prominent": false
    },
    "cold-storage": {
      "x": 973,
      "y": 889,
      "width": 65,
      "height": 31,
      "box": [
        943,
        875,
        1008,
        906
      ],
      "prominent": false
    },
    "green-housing": {
      "x": 255,
      "y": 617,
      "width": 11,
      "height": 20,
      "box": [
        251,
        609,
        262,
        629
      ],
      "prominent": false
    },
    "department": {
      "x": 643,
      "y": 328,
      "width": 28,
      "height": 34,
      "box": [
        630,
        308,
        658,
        342
      ],
      "prominent": false
    },
    "east-third": {
      "x": 1303,
      "y": 374,
      "width": 9,
      "height": 13,
      "box": [
        1299,
        368,
        1308,
        381
      ],
      "prominent": false
    },
    "south-house": {
      "x": 513,
      "y": 784,
      "width": 18,
      "height": 16,
      "box": [
        504,
        776,
        522,
        792
      ],
      "prominent": false
    },
    "first": {
      "x": 567,
      "y": 267,
      "width": 19,
      "height": 14,
      "box": [
        558,
        261,
        577,
        275
      ],
      "prominent": false
    },
    "hospital": {
      "x": 1294,
      "y": 164,
      "width": 43,
      "height": 27,
      "box": [
        1272,
        152,
        1315,
        179
      ],
      "prominent": true
    },
    "city-hall": {
      "x": 953,
      "y": 286,
      "width": 35,
      "height": 34,
      "box": [
        936,
        269,
        971,
        303
      ],
      "prominent": true
    },
    "school": {
      "x": 899,
      "y": 126,
      "width": 37,
      "height": 10,
      "box": [
        880,
        121,
        917,
        131
      ],
      "prominent": true
    },
    "post": {
      "x": 135,
      "y": 715,
      "width": 30,
      "height": 31,
      "box": [
        122,
        699,
        152,
        730
      ],
      "prominent": false
    },
    "hotel": {
      "x": 846,
      "y": 676,
      "width": 34,
      "height": 31,
      "box": [
        831,
        663,
        865,
        694
      ],
      "prominent": false
    },
    "east-hall": {
      "x": 1299,
      "y": 497,
      "width": 19,
      "height": 31,
      "box": [
        1290,
        481,
        1309,
        512
      ],
      "prominent": false
    },
    "seaside": {
      "x": 1230,
      "y": 744,
      "width": 77,
      "height": 70,
      "box": [
        1192,
        710,
        1269,
        780
      ],
      "prominent": false
    },
    "pump": {
      "x": 1058,
      "y": 896,
      "width": 26,
      "height": 27,
      "box": [
        1045,
        883,
        1071,
        910
      ],
      "prominent": false
    },
    "new-office": {
      "x": 1312,
      "y": 597,
      "width": 43,
      "height": 41,
      "box": [
        1291,
        575,
        1334,
        616
      ],
      "prominent": false
    },
    "community": {
      "x": 909,
      "y": 830,
      "width": 12,
      "height": 15,
      "box": [
        903,
        821,
        915,
        836
      ],
      "prominent": false
    },
    "park-office": {
      "x": 384,
      "y": 200,
      "width": 17,
      "height": 14,
      "box": [
        376,
        193,
        393,
        207
      ],
      "prominent": true
    },
    "nagihama-third": {
      "x": 1307,
      "y": 759,
      "width": 25,
      "height": 19,
      "box": [
        1295,
        749,
        1320,
        768
      ],
      "prominent": false
    }
  },
  "sightingLocations": {
    "first": {
      "x": 581,
      "y": 280
    },
    "east-third": {
      "x": 1288,
      "y": 375
    },
    "hall": {
      "x": 853,
      "y": 475
    },
    "cold-storage": {
      "x": 1006,
      "y": 927
    },
    "central": {
      "x": 799,
      "y": 507
    },
    "station": {
      "x": 716,
      "y": 433
    }
  },
  "townLabels": [
    [
      "西山台",
      431,
      132
    ],
    [
      "北町",
      777,
      208
    ],
    [
      "本町",
      590,
      291
    ],
    [
      "中央",
      756,
      489
    ],
    [
      "東町",
      1280,
      352
    ],
    [
      "緑町",
      336,
      588
    ],
    [
      "新町",
      511,
      701
    ],
    [
      "南町",
      698,
      795
    ],
    [
      "港南",
      944,
      865
    ],
    [
      "凪浜町",
      1377,
      628
    ]
  ],
  "geographicLabels": [
    {
      "text": "西山自然公園",
      "x": 202,
      "y": 143,
      "kind": "park"
    },
    {
      "text": "西山池",
      "x": 204,
      "y": 263,
      "kind": "water"
    },
    {
      "text": "北町運動公園",
      "x": 870,
      "y": 177,
      "kind": "park"
    },
    {
      "text": "三栖川",
      "x": 1189,
      "y": 130,
      "kind": "river",
      "rotate": 90
    },
    {
      "text": "三栖川大橋",
      "x": 1145,
      "y": 263,
      "kind": "bridge"
    },
    {
      "text": "凪浜大橋",
      "x": 1100,
      "y": 556,
      "kind": "bridge"
    },
    {
      "text": "三栖田線",
      "x": 402,
      "y": 383,
      "kind": "rail"
    },
    {
      "text": "三栖田駅",
      "x": 728,
      "y": 412,
      "kind": "station"
    },
    {
      "text": "三栖田港",
      "x": 1315,
      "y": 926,
      "kind": "water"
    }
  ],
  "blockLabels": [
    [
      "一丁目",
      672,
      296
    ],
    [
      "二丁目",
      740,
      439
    ],
    [
      "三丁目",
      658,
      491
    ],
    [
      "一丁目",
      1268,
      305
    ],
    [
      "三丁目",
      1308,
      403
    ],
    [
      "二丁目",
      1293,
      532
    ],
    [
      "二丁目",
      1467,
      351
    ],
    [
      "一丁目",
      1352,
      605
    ],
    [
      "三丁目",
      1353,
      797
    ],
    [
      "2",
      1270,
      790
    ],
    [
      "6",
      1320,
      782
    ]
  ],
  "geography": {
    "railwayLine": [
      [
        0,
        325
      ],
      [
        160,
        367
      ],
      [
        380,
        393
      ],
      [
        600,
        397
      ],
      [
        800,
        413
      ],
      [
        1120,
        443
      ],
      [
        1536,
        435
      ]
    ],
    "riverCenterline": [
      [
        1193,
        0
      ],
      [
        1196,
        150
      ],
      [
        1169,
        300
      ],
      [
        1125,
        450
      ],
      [
        1096,
        600
      ],
      [
        1091,
        750
      ],
      [
        1125,
        835
      ]
    ],
    "upperBridge": {
      "x": 1154,
      "y": 282
    },
    "lowerBridge": {
      "x": 1100,
      "y": 580
    }
  }
};
