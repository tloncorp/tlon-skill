:: Delete old posts hook: removes posts older than configured delay
:: Run as a cron job to periodically clean up channels
:: Config: delay (default ~d1 = 1 day)
::
|=  [=event:h =bowl:h]
^-  outcome:h
::  Only run on cron events
?.  ?=(%cron -.event)
  &+[[[%allowed event] ~] state.hook]
::  Get delay from config (default 1 day)
=+  ;;(delay=@dr (~(gut by config.bowl) 'delay' ~d1))
=/  cutoff  (sub now.bowl delay)
::  Need channel context for cron with origin
?~  channel.bowl
  &+[[[%allowed event] ~] state.hook]
::  Find and delete posts older than cutoff
=/  effects=(list effect:h)
  %+  murn
    (tap:on-v-posts:c (lot:on-v-posts:c posts.u.channel.bowl ~ `cutoff))
  |=  [=id-post:c post=(unit v-post:c)]
  ^-  (unit effect:h)
  ?~  post  ~
  `[%channels %channel nest.u.channel.bowl %post %del id-post]
&+[[[%allowed event] effects] state.hook]
