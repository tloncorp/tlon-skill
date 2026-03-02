:: Auto-react hook: reacts to new posts with configured emoji
:: Config: emoji (default :thumbsup:)
::
|=  [=event:h =bowl:h]
^-  outcome:h
::  Extract config with defaults
=+  ;;(emoji=cord (~(gut by config.bowl) 'emoji' ':thumbsup:'))
::  Only react to new posts
?.  ?=([%on-post %add *] event)
  &+[[[%allowed event] ~] state.hook.bowl]
::  Don't react to our own posts
?:  =(author.post.event our.bowl)
  &+[[[%allowed event] ~] state.hook.bowl]
::  Need channel context
?~  channel.bowl
  &+[[[%allowed event] ~] state.hook.bowl]
::  React to the post - structure: [%channels %channel nest [%post [%add-react id author react]]]
=/  react-effect=effect:h
  :*  %channels
      %channel
      nest.u.channel.bowl
      [%post [%add-react id.post.event our.bowl emoji]]
  ==
&+[[[%allowed event] [react-effect ~]] state.hook.bowl]
