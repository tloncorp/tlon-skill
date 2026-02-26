:: Word filter hook: blocks posts containing banned words
:: Config: words (comma-separated list of banned words)
::
|=  [=event:h =bowl:h]
^-  outcome:h
::  Only filter new posts
?.  ?=([%on-post %add *] event)
  &+[[[%allowed event] ~] state.hook]
::  Get banned words from config
=+  ;;(words=cord (~(gut by config.bowl) 'words' ''))
::  Convert to list of words (split on comma)
=/  banned=(list tape)
  %+  turn
    (rash words (more com (star ;~(less com prn))))
  trip
::  Get message content as tape
=/  content=tape
  %-  trip
  ?~  story.essay.post.on-post.event  ''
  ::  Extract text from first inline block
  =/  first  (head story.essay.post.on-post.event)
  ?+  -.first  ''
    %block  ''
    %inline  
      ?~  p.first  ''
      =/  inline  (head p.first)
      ?+  -.inline  ''
        %text  p.inline
      ==
  ==
::  Check if content contains any banned word
=/  has-banned=?
  %+  lien  banned
  |=  word=tape
  !=(~ (find word content))
::  If banned word found, deny the post
?:  has-banned
  &+[[[%denied `'Message contains prohibited content'] ~] state.hook]
::  Otherwise allow
&+[[[%allowed event] ~] state.hook]
