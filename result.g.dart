

class Chat extends Node {

  String id;
  List<User> users;
  String title;
  Chat({
    this.id,
    this.users,
    this.title,
  });

  factory Chat.fromJson(Map<String, dynamic> json) {
    return Chat(
      id: json['id'] as String,
      users: (json['users'] as List)?.map((e) => e == null ?
        null
        : User.fromJson(e as Map<String, dynamic>)
      )?.toList(),
      title: json['title'] as String
    );
  }

}

abstract class Node {
  String id;
}


enum ResultSort {
  ASC,
  DESC
}

class User extends Node {

  String username;
  String email;
  String name;
  List<User> friends;
  UserRole role;
  String id;
  User({
    this.username,
    this.email,
    this.name,
    this.friends,
    this.role,
    this.id,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      username: json['username'] as String,
      email: json['email'] as String,
      name: json['name'] as String,
      friends: (json['friends'] as List)?.map((e) => e == null ?
        null
        : User.fromJson(e as Map<String, dynamic>)
      )?.toList(),
      role: UserRole.values.firstWhere((e) => e.toString() == 'UserRole.' + json['role'] as UserRole),
      id: json['id'] as String
    );
  }

}

enum UserRole {
  ADMIN,
  USER,
  EDITOR
}
