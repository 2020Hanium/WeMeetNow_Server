const e = require('express');

express = require('express'),
http = require('http'),
app = express(),
server = http.createServer(app),
io = require('socket.io').listen(server);
mysql = require('mysql');
mysql_store = require('express-mysql-session');
session = require('express-session');

app.set('port', process.env.PORT || 8080);

app.get('/', (req, res) => {
res.sendFile(__dirname + '/index.html');
});

var httpserver = server.listen(8080,()=>{
  console.log('Node app is running on port 8080');
  });

  var connection = mysql.createConnection({
    host: "",
    user: "",
    database: "",
    password: "",
    port: 3306,
    multipleStatements: true
});

var socketList = [];
var connectCounter = 0;

io.on('connection', (socket) => {

console.log('user connected');

//회원가입 기능
socket.on('add_user', function(data) {

  var userEmail = data.userEmail;
  var userPwd = data.userPwd;
  var userName = data.userName;

  var sql = 'INSERT INTO Users_test1 (UserEmail, UserPwd, UserName) VALUES (?, ?, ?)';
  var params = [userEmail, userPwd, userName];

  connection.query(sql, params, function (err, result) {
    if (err) {
        console.log(err);
    } else {           
       console.log('성공');
    }
  });
});

//로그인 기능
socket.on('login', function(data) {
    console.log(data);
  var userEmail = data.userEmail;
  var userPwd = data.userPwd;

  var sql = 'select * from Users_test1 where UserEmail = ?';


  connection.query(sql, userEmail, function (err, result) {

    if (err) {
        console.log(err);
    } else {
        if (result.length === 0) {
            console.log("존재하지 않는 계정입니다.");
            socket.emit('no_id');
        } else if (userPwd !== result[0].userPwd) {
            console.log('비밀번호가 틀렸습니다!');
            socket.emit('wrong_pw');
        } else {
            console.log('로그인 성공! ' + result[0].userName + '님 환영합니다!');
            console.log(socket.id);

            var string_Name = result[0].userName

            socket.emit('login_info', {name: string_Name} );

            socket.authId = userEmail;
            socket.userName = result[0].userName;

            socketList.push(socket);
            connectCounter = (connectCounter + 1);

            console.log(connectCounter);
            console.log(socketList[(connectCounter-1)].id);
            console.log(socketList[(connectCounter-1)].authId);
        }
    }
  })
})

//친구 추가 기능
socket.on('add_friend', function(data) {

    var findResult = false;
    var sender = socket.authId;
    var senderName = socket.userName;
    var besender = data.friendEmail;

    for (i = 0; i <= connectCounter-1; i++) {
    if(socketList[i].authId == besender) {
        findResult = true;

        var besenderName = socketList[i].userName

        var goal = socketList[i].id;
        console.log(besender+"is founded!");
        socket.emit("ok_add_friend", {id: besenderName});

        } else { console.log("Searching...")}
    }

        //친신 온거 알려주는 기능
    socket.on("accept_friend", function() {

    for (i = 0; i <= connectCounter-1; i++) {
        if(socketList[i].authId == besender) {
            goal = socketList[i].id;
        }
    }

    if(findResult == false) {
        socket.emit("false_add_friend");
        //앱에서는 socket.on('false_add_friend')를 통해 검색 실패 알림
    }
    
    socket.to(goal).emit('chosen', {sender: sender, senderName: senderName});
        //앱에서는 socket.on('chosen') 을 통해서 친신온걸 알려줌
  
        var sql = 'INSERT INTO friend (sender, besender) VALUES (?, ?)';
        var params = [sender, besender];

        connection.query(sql, params, function (err, result) {

            if (err) {
                console.log(err);
            } else {
                console.log('친구 신청을 보냈습니다.');
                console.log('친구 이름 : '+besender);
                }
            });
        })

    //친구 지인짜 완료 기능
    socket.on('yes_friend', function(yes_data) {

        var receiver = besender;
        var bereceiver = sender;

         var sql = 'UPDATE friend SET receiver = (?), bereceiver = (?)'
         var param = [receiver, bereceiver];

         connection.query(sql, param, function(err, result) {

            if(err) {
                console.log(err);
            } else {
                console.log(socket.authId + '님과 친구가 되었습니다!');
                }
            })
        });
    }); //친구추가 끝

    //파티개설 시작

    socket.on('search_friend', function() { 
        var accept_partyCount = 0;
        var total_partyCount = 1;
        var friend = {};
        var party_friend = new Array(100);
        var bereceiver = socket.authId;
        
        var sql = 'select receiver from friend where bereceiver = ?'
        var param = [bereceiver];

        connection.query(sql, param, function (err, result) {

            if (err) {
                console.log(err);
            } else {
                friend = result.receiver;
            }
          })

          socket.emit('your_friend', friend);

          //친구목록의 이름을 터치할 때마다 앱에서 emit해줄때 여기서받음
          socket.on('friend_list', function(friend_data) {
              var list = friend_data.receiver;
              party_friend.push(list);
          });

          socket.on('open_party', function(open_data) {
            var head = socket.userEmail;
            var party_name = open_data.party_name;
            var party_time = open_data.party_time;
            var party_placelat = null;
            var party_placelong = null;
            var party_success = false;

            var head_placelat = open_data.head_placelat;
            var head_placelong = open_data.head_placelong;

            var open_sql = 'INSERT INTO time_test1 (party_head, party_name, party_placelat, party_placelong, time_info, party_success) VALUES (?, ?, ?, ?, ?, ?)'
            var param = [head, party_name, party_placelat, party_placelong, party_time, party_success];

            connection.query(open_sql, param, function(err, result) {

                if(err) {
                    console.log(err);
                } else {

                    var goal_party;

                    for (i = 0; i < connectCounter; i++) {

                        if(socketList[i].userEmail == party_friend[i]) {
                            goal_party = socketList[i].id

                            socket.to(goal_party).emit('invite_party', {party_name: party_name});
                            total_partyCount = total_partyCount + 1;
                            //여긴 임시
                        }
                    }

                    socket.head_placelat = head_placelat;
                    socket.head_placelong = head_placelong;
                    
                    console.log("파티 개설 성공!");
                    socket.emit('ok_partyhead', {party_name: party_name});

                    accept_partyCount = accept_partyCount + 1;
                    
                }
            });
        });

        //파티 초대에 응했을 경우의 기능
        socket.on('join_party', function(join_data) {
            var member_placelat = join_data.member_placelat;
            var member_placelong = join_data.member_placelong;
            
            
            socket.member_placelat = member_placelat;
            socket.member_placelong = member_placelong;

            accept_partyCount = accept_partyCount + 1;
            
            socket.emit('partyCounter', {total_partyCount: total_partyCount, accept_partyCount: accept_partyCount});

            if ( total_partyCount == accept_partyCount) {
                socket.emit('real_party');
            }

        });
    });
});





/*
//친구 추가 기능
socket.on('add_friend', function(data) {

    var sender = socket.authId;
    var besender = data.friendEmail;

    var sql = 'INSERT INTO friend (sender, besender) VALUES (?, ?)';
    var params = [sender, besender];

    connection.query(sql, params, function (err, result) {

        if (err) {
            console.log(err);
        } else {
            console.log('친구 신청을 보냈습니다.');
            console.log('친구 이름 : '+besender);
            
            for(i=0; i <= connectCounter-1; i++) {

                if(besender == socketList[i].authId) {
                    io.to(socketList[i].id).emit('test');
                }
                console.log('친구 찾는 중...');
            }
        }
    });
});
*/