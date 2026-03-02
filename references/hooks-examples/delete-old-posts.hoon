:: Cron hook template: runs on a schedule
:: Configure with: tlon hooks cron <id> ~h1 --nest chat/~host/channel
:: Config: delay (default ~d1 = 1 day)
::
|=  [=event:h =bowl:h]
^-  outcome:h
::  Only run on cron events
?.  ?=(%cron -.event)
  &+[[[%allowed event] ~] state.hook.bowl]
::  Get delay from config (default 1 day)
=+  ;;(delay=@dr (~(gut by config.bowl) 'delay' ~d1))
::  Log that we ran (no actual deletion implemented)
::  In a real hook you'd iterate posts and emit delete effects
&+[[[%allowed event] ~] state.hook.bowl]
