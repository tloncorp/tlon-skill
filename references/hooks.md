# Tlon Channel Hooks

Hooks are hoon functions that modify events, cause effects, and/or build state for channels.

## Hook Structure

```hoon
++  hook
  $:  id=id-hook
      version=%0
      name=@t
      meta=data:m
      src=@t
      compiled=(unit vase)
      state=vase
      config=(map nest config)
  ==
```

- `id` - unique identifier (@uv format)
- `version` - the version this hook was written for
- `name` - human-readable display name
- `meta` - standard metadata (title/image/desc/cover)
- `src` - the source code for the hook
- `compiled` - result of compiling hoon to nock
- `state` - container to collect/persist data
- `config` - configurations for each channel

## Events

Hooks respond to four event types:

```hoon
+$  event
  $%  [%on-post on-post]
      [%on-reply on-reply]
      [%cron ~]
      [%wake waiting-hook]
  ==
```

### on-post events
```hoon
+$  on-post
  $%  [%add post=v-post]
      [%edit original=v-post =essay]
      [%del original=v-post]
      [%react post=v-post =ship react=(unit react)]
  ==
```

### on-reply events
```hoon
+$  on-reply
  $%  [%add parent=v-post reply=v-reply]
      [%edit parent=v-post original=v-reply =memo]
      [%del parent=v-post original=v-reply]
      [%react parent=v-post reply=v-reply =ship react=(unit react)]
  ==
```

## Bowl (Context)

Hooks receive ambient state via the bowl:

```hoon
+$  bowl
  $:  channel=(unit [=nest v-channel])   :: current channel (null for global cron)
      group=(unit group-ui:g)            :: group data
      channels=v-channels                :: all hosted channels
      =hook                              :: this hook's data
      =config                            :: channel-specific config
      now=time                           :: current time
      our=ship                           :: host ship
      src=ship                           :: triggering ship
      eny=@                              :: entropy
  ==
```

## Return Type

```hoon
+$  outcome  (each return tang)

+$  return
  $:  result=event-result
      effects=(list effect)
      new-state=vase
  ==

+$  event-result
  $%  [%allowed =event]      :: allow event, optionally transform it
      [%denied msg=(unit cord)]  :: block event with optional message
  ==
```

## Effects

Hooks can trigger actions on other agents:

```hoon
+$  effect
  $%  [%channels =a-channels]   :: channel actions
      [%groups =action:g]       :: group actions (ban, kick, etc)
      [%activity =action:a]     :: activity actions
      [%dm =action:dm:ch]       :: DM actions
      [%club =action:club:ch]   :: group DM actions
      [%contacts =action:co]    :: contact actions
      [%wait waiting-hook]      :: schedule delayed execution
  ==
```

## Config

Config is `(map @t *)` - use clam (`;;`) to extract typed values:

```hoon
=+  ;;(delay=@dr (~(gut by config.bowl) 'delay' ~s30))
=+  ;;(emoji=cord (~(gut by config.bowl) 'emoji' ':thumbsup:'))
```

## Writing a Hook

Basic hook template:

```hoon
|=  [=event:h =bowl:h]
^-  outcome:h
::  Return success with: [allowed-result effects new-state]
&+[[[%allowed event] ~] state.hook]
```

### Example: Auto-react to new posts

```hoon
|=  [=event:h =bowl:h]
^-  outcome:h
::  Get emoji from config, default to thumbsup
=+  ;;(emoji=cord (~(gut by config.bowl) 'emoji' ':thumbsup:'))
::  Only react to new posts
?.  ?=([%on-post %add *] event)
  &+[[[%allowed event] ~] state.hook]
::  Build the react effect
=/  react-effect
  :*  %channels
      %channel
      nest.u.channel.bowl
      %post
      %reply
      id.post.on-post.event
      %add
      [our.bowl now.bowl (some emoji) ~ ~]
  ==
&+[[[%allowed event] [react-effect ~]] state.hook]
```

### Example: Delete old messages (cron)

```hoon
|=  [=event:h bowl:h]
^-  outcome:h
::  Only run on cron events
?.  ?=(%cron -.event)
  &+[[[%allowed event] ~] state.hook]
::  Get delay from config
=+  ;;(delay=@dr (~(gut by config.bowl) 'delay' ~s30))
=/  cutoff  (sub now delay)
?~  channel  &+[[[%allowed event] ~] state.hook]
::  Find posts older than cutoff and delete them
=/  effects=(list effect:h)
  %+  murn
    (tap:on-v-posts:c (lot:on-v-posts:c posts.u.channel ~ `cutoff))
  |=  [=id-post:c post=(unit v-post:c)]
  ^-  (unit effect:h)
  ?~  post  ~
  `[%channels %channel nest.u.channel %post %del id-post]
&+[[[%allowed event] effects] state.hook]
```

### Example: Ban users who post slurs

```hoon
|=  [=event:h =bowl:h]
^-  outcome:h
?.  ?=([%on-post %add *] event)
  &+[[[%allowed event] ~] state.hook]
::  Check if message contains banned words (simplified)
=/  content  (trip content.essay.post.on-post.event)
=/  has-slur  :: your detection logic here
  %.n
?.  has-slur
  &+[[[%allowed event] ~] state.hook]
::  Deny the post and ban the user
=/  ban-effect
  [%groups flag.u.group.bowl %fleet (sy src.bowl ~) %del ~]
&+[[[%denied `'Banned for prohibited content'] [ban-effect ~]] state.hook]
```

## CLI Commands

```bash
# Add a hook
tlon hooks add "my-hook" ./hook.hoon

# Configure for a channel
tlon hooks config <id> chat/~host/channel delay=~m5 emoji=:fire:

# Set execution order
tlon hooks order chat/~host/channel <id1> <id2>

# Schedule periodic execution
tlon hooks cron <id> ~h1 --nest chat/~host/channel

# List hooks
tlon hooks list
```

## Testing Hooks (Dojo)

Test without affecting channels:

```
-groups!hooks-run <event> [%origin nest optional-state optional-config] <src>
```

## Type References

- Full hooks types: https://github.com/tloncorp/tlon-apps/blob/develop/desk/sur/hooks.hoon
- Channel types (v-post, v-reply, etc): https://github.com/tloncorp/tlon-apps/blob/develop/desk/sur/channels.hoon
