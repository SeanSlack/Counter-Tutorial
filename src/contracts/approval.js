const tealSource = `#pragma version 5
txn ApplicationID
int 0
==
bnz main_l20
txn OnCompletion
int NoOp
==
bnz main_l11
txn OnCompletion
int OptIn
==
bnz main_l10
txn OnCompletion
int CloseOut
==
bnz main_l9
txn OnCompletion
int DeleteApplication
==
bnz main_l8
txn OnCompletion
int UpdateApplication
==
bnz main_l7
err
main_l7:
txn Sender
byte "owner"
app_global_get
==
return
main_l8:
txn Sender
byte "owner"
app_global_get
==
return
main_l9:
int 1
return
main_l10:
int 1
return
main_l11:
txna ApplicationArgs 0
byte "minus"
==
bnz main_l17
txna ApplicationArgs 0
byte "add"
==
bnz main_l16
txna ApplicationArgs 0
byte "set"
==
bnz main_l15
err
main_l15:
byte "Counter"
txna ApplicationArgs 1
btoi
app_global_put
int 1
return
main_l16:
byte "Counter"
app_global_get
store 0
byte "Counter"
load 0
int 1
+
app_global_put
int 1
return
main_l17:
byte "Counter"
app_global_get
store 0
load 0
int 0
>
bnz main_l19
main_l18:
int 1
return
main_l19:
byte "Counter"
load 0
int 1
-
app_global_put
b main_l18
main_l20:
byte "owner"
txn Sender
app_global_put
byte "Counter"
int 0
app_global_put
int 1
return`;

module.exports = tealSource;
