:: Auto-react hook: reacts to new posts with configured emoji
:: Config: emoji (default :thumbsup:), delay (default ~s5)
::
|=  [=event:h =bowl:h]
^-  outcome:h
::  Extract config with defaults
=+  ;;(emoji=cord (~(gut by config.bowl) 'emoji' ':thumbsup:'))
=+  ;;(delay=@dr (~(gut by config.bowl) 'delay' ~s5))
::  Only react to new posts
?.  ?=([%on-post %add *] event)
  &+[[[%allowed event] ~] state.hook]
::  Don't react to our own posts
?:  =(src.bowl our.bowl)
  &+[[[%allowed event] ~] state.hook]
::  Schedule a delayed reaction using %wait
=/  wait-effect=effect:h
  :*  %wait
      (sham eny.bowl)        :: unique id for this wait
      id.hook.bowl           :: hook id
      !>(event)              :: data to pass when waking
      (add now.bowl delay)   :: when to fire
  ==
&+[[[%allowed event] [wait-effect ~]] state.hook]
