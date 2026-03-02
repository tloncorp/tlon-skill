:: Word filter hook: blocks posts containing banned words
:: Config: word (single word to block)
::
|=  [=event:h =bowl:h]
^-  outcome:h
|^
::  Only filter new posts
?.  ?=([%on-post %add *] event)
  &+[[[%allowed event] ~] state.hook.bowl]
::  Get banned word from config
=+  ;;(word=cord (~(gut by config.bowl) 'word' ''))
::  Skip if no word configured
?:  =('' word)
  &+[[[%allowed event] ~] state.hook.bowl]
::  Get message content
=/  content=tape  (extract-text content.post.event)
::  Check if banned word appears in content
=/  has-banned=?  !=(~ (find (trip word) content))
::  If found, deny
?:  has-banned
  &+[[[%denied `'Message contains prohibited content'] ~] state.hook.bowl]
::  Otherwise allow
&+[[[%allowed event] ~] state.hook.bowl]
++  extract-text
  |=  =story:c
  ^-  tape
  ?~  story  ""
  =/  verse  i.story
  ?.  ?=(%inline -.verse)  ""
  ?~  p.verse  ""
  =/  inl  i.p.verse
  ?@  inl
    (trip inl)
  ""
--
