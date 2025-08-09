from ....email_verification.py.verificate_code import app, db, Manager

with app.app_context():
    # 添加测试管理员数据
    db.session.add(Manager(username="admin1", email="admin1@example.com", phone="1234567890"))
    db.session.add(Manager(username="admin2", email="admin2@example.com", phone="0987654321"))
    db.session.commit()
    print("Manager database initialized")