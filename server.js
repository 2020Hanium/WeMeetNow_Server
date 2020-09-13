
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
        socket.emit('fail_add_user');
    } else {           
       console.log('성공');
       socket.emit('success_add_user');
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
            socket.userName = string_Name;

            socketList.push(socket);
            
            console.log(socketList.length);
            console.log(socketList[((socketList.length)-1)].id);
            console.log(socketList[((socketList.length)-1)].authId);
        }
    }
  })
})

//로그아웃 기능
socket.on('disconnect', function(data) {

    socketList.splice(socketList.indexOf(socket), 1);
    console.log(socket.authId + 'LOGOUT!');

});

//친구 추가 기능
socket.on('add_friend', function(data) {

    var findResult = false;
    var besender = data.friendEmail;

    for (i = 0; i <= (socketList.length)-1; i++) {
    if(socketList[i].authId == besender) {
        findResult = true;
        var besenderName = socketList[i].userName

        console.log(besender + '/' + besenderName +"is founded!");
        socket.emit("ok_add_friend", {id: besenderName});

        } else { console.log("Searching...")}
    }
 
    if(findResult == false) {
        socket.emit("false_add_friend");
        //앱에서는 socket.on('false_add_friend')를 통해 검색 실패 알림
        }
    });

            //친신 온거 알려주는 기능
            socket.on("accept_friend", function(data) {
                var sender = socket.authId;
                var senderName = socket.userName;
                var besender = data.friendEmail;
                var goal;

                for (i = 0; i <= (socketList.length)-1; i++) {
                    if(socketList[i].authId == besender) {
                        
                        goal = socketList[i].id;
                    }
                }
                         
                    var sql = 'INSERT INTO friend (sender, besender) VALUES (?, ?)';
                    var params = [sender, besender];
            
                    connection.query(sql, params, function (err, result) {
            
                        if (err) {
                            console.log(err);
                            socket.emit('fail_accept_friend');
                        } else {
                            socket.to(goal).emit('chosen', {sender: sender, senderName: senderName});
                            //앱에서는 socket.on('chosen') 을 통해서 친신온걸 알려줌

                            console.log('친구 신청을 보냈습니다.');
                            console.log('친구 아이디 : ' + besender);

                            
                            }
                        });
                    });

        //친구 지인짜 완료 기능
        socket.on('yes_friend', function(data) {
            console.log('yes_friend on');
    
            var receiver = socket.authId;
            var receiverName = socket.userName;
            var bereceiver = data.sender;
            var bereceiverName = data.senderName;
    
             var sql = 'UPDATE friend SET receiver = (?), bereceiver = (?), receiverName = (?) WHERE (sender = (?)) AND (besender = (?))'
             var params = [receiver, bereceiver, receiverName, bereceiver, receiver];

             var sql_insert = 'INSERT INTO friend (sender, besender, receiver, bereceiver, receiverName) VALUES (?, ?, ?, ?, ?)'
             var params_insert = [receiver, bereceiver, bereceiver, receiver, bereceiverName]
    
             connection.query(sql, params, function(err, result) {
    
                if(err) {
                    console.log(err);
                } else {
                    console.log(socket.authId + '/' + socket.userName + '님과 친구가 되었습니다!');
                    }
                })

                connection.query(sql_insert, params_insert, function(err, result) {
                    if(err) {
                        console.log(err);
                    } else {
                        console.log('INSERT SUCCESS');
                        socket.emit('finish_friend');
                    }
                })
            });

    //친구 조회 기능
    socket.on('refresh_friend', function() {
        console.log('refresh_friend on');
        var me = socket.authId;
        var friends = new Array();
        
        var sql = 'select receiverName from friend where bereceiver = ?'
        var param = [me];

        connection.query(sql, param, function (err, result) {

            if (err) {
                console.log(err);
            } else {
                for (i = 0; i < result.length; i++) {
                    var Json_friend = new Object();
                    Json_friend.name = result[i].receiverName;
                    friends.push(Json_friend);
                    }

                socket.emit('friend_list', friends);

                console.log(friends);
                console.log('friend_list on');
            }
          })
    });


    //파티개설

    socket.on('open_party', function(open_data) {
        var head = socket.userEmail;
        var party_name = open_data.party_name;

        //시간받아오는거 고비 1
        var party_time = open_data.party_time;
        var party_placelat = null;
        var party_placelong = null;
        var party_success = false;
        var party_list = new Array(100);

        var accept_partyCount = 0;
        var total_partyCount = 1;

        var head_placelat = open_data.head_placelat;
        var head_placelong = open_data.head_placelong;

        var open_sql = 'INSERT INTO party_head (party_head, party_name, party_placelat, party_placelong, time_info, party_success) VALUES (?, ?, ?, ?, ?, ?)'
        var param = [head, party_name, party_placelat, party_placelong, party_time, party_success];

        connection.query(open_sql, param, function(err, result) {

            if(err) {
                console.log(err);
            } else {

                var goal_party;

                //members 는 초대받을 사람의 아이디
                //open_data.members[i] 형식으로 넣는 것도 고려해야함
                //아이디 저장하는거 고비 2
                //party_list.push(open_data.members); 이것도 고려
                party_list = open_data.members;

                for (i = 0; i < (socketList.length); i++) {
                  
                    if(socketList[i].userEmail == party_list[i]) {
                        goal_party = socketList[i].id

                        socket.to(goal_party).emit('invite_party', {party_name: party_name, head: head});
                        total_partyCount = total_partyCount + 1;
                        
                    }
                }
                
                socket.head_placelat = head_placelat;
                socket.head_placelong = head_placelong;
                
                console.log("파티 개설 성공!");
                accept_partyCount = accept_partyCount + 1;
                
                socket.emit('ok_partyhead', {party_name: party_name, total_partyCount: total_partyCount, accept_partyCount: accept_partyCount});               
            }
        });
    });

    //파티 초대에 응했을 경우의 기능
    socket.on('join_party', function(join_data) {
        console.log('join_party on')

        var total_partyCount = join_data.total_partyCount;
        var accept_partyCount = join_data.accept_partyCount;
        var member_placelat = join_data.member_placelat;
        var member_placelong = join_data.member_placelong;

        var member = socket.authId;
        var head = join_data.head;
        var party_name = join_data.party_name;
            
        socket.member_placelat = member_placelat;
        socket.member_placelong = member_placelong;

        var sql = 'INSERT INTO party_memeber (party_member, party_head, party_name) VALUES (?, ?, ?)';
        var params = [member, head, party_name]; 

        connection.query(sql, params, function(err, result) {
            if(err) {
                console.log(err);
            } else {
                console.log('MEMBER REGIST OK');
                accept_partyCount = accept_partyCount + 1;
                socket.emit('partyCounter', {accept_partyCount: accept_partyCount});
            }
        });

        if ( total_partyCount == accept_partyCount) {
            socket.emit('real_party');
        }

    });
});