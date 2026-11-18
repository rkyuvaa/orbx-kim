with open('tests/test_requirement_approval_email.py', 'r') as f:
    content = f.read()

# Fix all occurrences of excessive indentation (16 spaces -> 8 spaces)
content = content.replace('                approver = make_user(db, "approver@kim.com", UserRole.ADMIN, "Jane Approver")', '        approver = make_user(db, "approver@kim.com", UserRole.ADMIN, "Jane Approver")')
content = content.replace('                approver = make_user(db, "itapprover@kim.com", UserRole.ADMIN, "IT Jane")', '        approver = make_user(db, "itapprover@kim.com", UserRole.ADMIN, "IT Jane")')
content = content.replace('                approver = make_user(db, "finderapprover@kim.com", UserRole.ADMIN, "Finder Approver")', '        approver = make_user(db, "finderapprover@kim.com", UserRole.ADMIN, "Finder Approver")')
content = content.replace('                approver = make_user(db, "pageapprover@kim.com", UserRole.ADMIN, "Page Approver")', '        approver = make_user(db, "pageapprover@kim.com", UserRole.ADMIN, "Page Approver")')
content = content.replace('                approver = make_user(db, "expiredapprover@kim.com", UserRole.ADMIN, "Expired Approver")', '        approver = make_user(db, "expiredapprover@kim.com", UserRole.ADMIN, "Expired Approver")')
content = content.replace('                approver = make_user(db, "usedapprover@kim.com", UserRole.ADMIN, "Used Approver")', '        approver = make_user(db, "usedapprover@kim.com", UserRole.ADMIN, "Used Approver")')
content = content.replace('                approver = make_user(db, "approveapprover@kim.com", UserRole.ADMIN, "Approve Approver")', '        approver = make_user(db, "approveapprover@kim.com", UserRole.ADMIN, "Approve Approver")')
content = content.replace('                approver = make_user(db, "rejectapprover@kim.com", UserRole.ADMIN, "Reject Approver")', '        approver = make_user(db, "rejectapprover@kim.com", UserRole.ADMIN, "Reject Approver")')
content = content.replace('                approver = make_user(db, "reject2approver@kim.com", UserRole.ADMIN, "Reject2 Approver")', '        approver = make_user(db, "reject2approver@kim.com", UserRole.ADMIN, "Reject2 Approver")')
content = content.replace('                approver = make_user(db, "logapprover@kim.com", UserRole.ADMIN, "Log Approver")', '        approver = make_user(db, "logapprover@kim.com", UserRole.ADMIN, "Log Approver")')
content = content.replace('                approver = make_user(db, "concurrentapprover@kim.com", UserRole.ADMIN, "Concurrent Approver")', '        approver = make_user(db, "concurrentapprover@kim.com", UserRole.ADMIN, "Concurrent Approver")')

with open('tests/test_requirement_approval_email.py', 'w') as f:
    f.write(content)
print('Done')