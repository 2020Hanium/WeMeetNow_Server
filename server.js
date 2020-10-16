
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
    multipleStatements: true,
    dateStrings:'date'
});

var socketList = [];

io.on('connection', (socket) => {

    console.log('user connected');

    //회원가입 기능
    socket.on('add_user', function (data) {

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
    socket.on('login', function (data) {
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

                    socket.emit('login_info', { name: string_Name });

                    socket.authId = userEmail;
                    socket.userName = string_Name;

                    socketList.push(socket);

                    console.log(socketList.length);
                    console.log(socketList[((socketList.length) - 1)].id);
                    console.log(socketList[((socketList.length) - 1)].authId);
                }
            }
        })
    })

    //로그아웃 기능
    socket.on('disconnect', function (data) {

        socketList.splice(socketList.indexOf(socket), 1);
        
        console.log(socket.authId + 'LOGOUT!');

    });

    //친구 추가 기능
    socket.on('add_friend', function (data) {

        var findResult = false;
        var besender = data.friendEmail;

        for (i = 0; i <= (socketList.length) - 1; i++) {
            if (socketList[i].authId == besender) {
                findResult = true;
                var besenderName = socketList[i].userName

                console.log(besender + '/' + besenderName + "is founded!");
                socket.emit("ok_add_friend", { id: besenderName });

            } else { console.log("Searching...") }
        }

        if (findResult == false) {
            socket.emit("false_add_friend");
            //앱에서는 socket.on('false_add_friend')를 통해 검색 실패 알림
        }
    });

    //친신 온거 알려주는 기능
    socket.on("accept_friend", function (data) {
        var sender = socket.authId;
        var senderName = socket.userName;
        var besender = data.friendEmail;
        var goal;

        for (i = 0; i <= (socketList.length) - 1; i++) {
            if (socketList[i].authId == besender) {

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
                socket.to(goal).emit('chosen', { sender: sender, senderName: senderName });
                //앱에서는 socket.on('chosen') 을 통해서 친신온걸 알려줌

                console.log('친구 신청을 보냈습니다.');
                console.log('친구 아이디 : ' + besender);


            }
        });
    });

    //친구 지인짜 완료 기능
    socket.on('yes_friend', function (data) {
        console.log('yes_friend on');

        var receiver = socket.authId;
        var receiverName = socket.userName;
        var bereceiver = data.sender;
        var bereceiverName = data.senderName;

        var sql = 'UPDATE friend SET receiver = (?), bereceiver = (?), receiverName = (?) WHERE (sender = (?)) AND (besender = (?))'
        var params = [receiver, bereceiver, receiverName, bereceiver, receiver];

        var sql_insert = 'INSERT INTO friend (sender, besender, receiver, bereceiver, receiverName) VALUES (?, ?, ?, ?, ?)'
        var params_insert = [receiver, bereceiver, bereceiver, receiver, bereceiverName]

        connection.query(sql, params, function (err, result) {

            if (err) {
                console.log(err);
            } else {
                console.log(socket.authId + '/' + socket.userName + '님과 친구가 되었습니다!');
            }
        })

        connection.query(sql_insert, params_insert, function (err, result) {
            if (err) {
                console.log(err);
            } else {
                console.log('INSERT SUCCESS');
                socket.emit('finish_friend');
            }
        })
    });

    //친구 조회 기능
    socket.on('refresh_friend', function () {
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
    //받아올 값 : party_name, party_time, members

    socket.on('open_party', function (open_data) {
        var head = socket.authId;
        var head_name = socket.userName;
        var party_name = open_data.party_name;
        var party_time = open_data.party_time;
        var party_placelat = null;
        var party_placelong = null;
        
        console.log("open_party start");
        console.log(open_data);
        console.log(open_data.members.length);
        
        var total_partyCount = 1;

        var open_sql = 'INSERT INTO party_head (party_head, party_name, party_placelat, party_placelong, time_info) VALUES (?, ?, ?, ?, ?)'
        var param = [head, party_name, party_placelat, party_placelong, party_time];

        connection.query(open_sql, param, function (err, result) {

            if (err) {
                console.log(err);
                socket.emit('fail_open_party');
            } else {
                var goal_party;
                
                total_partyCount += open_data.members.length;

                for (i = 0; i < (open_data.members.length); i++) {

                    for(j = 0; j < socketList.length; j++){

                        console.log(open_data.members[i]);
                        console.log(socketList[j].userName);

                        if ( open_data.members[i] == socketList[j].userName) {
                            goal_party = socketList[j].id;
    
                            console.log('FOUNDED');
                            socket.to(goal_party).emit('invite_party', { party_name: party_name, head: head, total_partyCount: total_partyCount, head_name: head_name });
                            
                        } else {
                            console.log('MAKING PARTY ...')
                        }
                    }
                }
                
                console.log("파티 개설 성공!");

                socket.emit('ok_partyhead', { party_name: party_name, total_partyCount: total_partyCount });
            }
        });
    });

    //파티 초대에 응했을 경우의 기능
    //받아올 값 : total_partyCount, member_placelat, member_placelong, head, party_name

    socket.on('join_party', function (join_data) {
        console.log('join_party on')
        console.log(join_data)


        var total_partyCount = join_data.total_partyCount;
        
        var member_placelat = join_data.member_placelat;
        var member_placelong = join_data.member_placelong;

        var member = socket.authId;
        var head = join_data.head;
        var party_name = join_data.party_name;

        socket.member_placelat = member_placelat;
        socket.member_placelong = member_placelong;

        var party_time;
       

        var time_sql = 'select time_info from party_head where party_name = ?'
        var time_param = [party_name];

        connection.query(time_sql, time_param, function(err, data) {
            if(err) {
                console.log(err);
                socket.emit('FAIL_TIME_INFO');
            } else {
                console.log(data);
                
                party_time = data[0].time_info;
                console.log(party_time);
                
            }
        });


        var sql = 'INSERT INTO party_member (party_member, party_head, party_name, party_member_placelat, party_member_placelong) VALUES (?, ?, ?, ?, ?)';
        var params = [member, head, party_name, member_placelat, member_placelong];

        connection.query(sql, params, function (err, result) {
            if (err) {
                console.log(err);
                socket.emit('FAIL_INSERT_MEMBER');
            } else {
                socket.join(party_name);
                socket.party_name = party_name;
                socket.emit('SUCCESS_INSERT_MEMBER');

                console.log('MEMBER REGIST OK');
            }
        });

        
        var sql_member = 'select * from party_member where party_name = ?'
        var param_member = [party_name];

        connection.query(sql_member, param_member, function(err, result) {
            if(err) {
                console.log(err);
                socket.emit('FAIL_SELECT_MEMBER');
            } else {
                console.log('member_count on');

                var member_count = result.length;
                var time_info = party_time;

                //socket.emit('member_count', {member_count: member_count});
                io.sockets.in(party_name).emit('member_count', {member_count: member_count, time_info: time_info});


                /*
                for(i = 0; i < socketList.length; i++) {
                    if (socketList[i].authId = head) {

                        var headAddress = socketList[i].id;
                        socket.to(headAddress).emit('member_count', {member_count: member_count});

                    } else {
                        console.log('HEAD MISS');
                    }
                }

                */

                if (total_partyCount == member_count) {
                    socket.emit('FULL_PARTY');
                }
            }
        });

    });

    /*
    //파티 조회 기능
    socket.on('refresh_party', function (data) {
        console.log('refresh_party on');
        io.sockets.clients(socket.party_name);

        var myparty = socket.party_name;
        var members = new Array();

        var sql = 'select party_member from party_member where party_name = ?'
        var param = [myparty];

        connection.query(sql, param, function (err, result) {

            if (err) {
                console.log(err);
            } else {
                for (i = 0; i < result.length; i++) {
                    var Json_member = new Object();
                    Json_member.party_member = result[i].party_member;
                    members.push(Json_member);
                }

                socket.emit('member_list', members);

                console.log(members);
                console.log('member_list on');
            }
        })
    });
    */
    //파티 장소 선택 기능

    socket.on('RTL', function(data) {


    });

});