# [WebKit Features in Safari 16.4](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/ "Permanent Link: WebKit Features in Safari 16.4")

Mar 27, 2023

by Patrick Angle, Marcos Caceres, Razvan Caliman, Jon Davis, Brady Eidson, Timothy Hatcher, Ryosuke Niwa, and Jen Simmons

<menu><menuitem>###### <label>Contents</label>

* [Web Push on iOS and iPadOS](#web-push-on-ios-and-ipados)
* [Improvements for Web Apps](#improvements-for-web-apps)
* [Web Components](#web-components)
* [CSS](#css)
* [HTML](#html)
* [JavaScript and WebAssembly](#javascript-and-webassembly)
* [Web API](#web-api)
* [Images, Video, and Audio](#images-video-and-audio)
* [WKWebView](#wkwebview)
* [Developer Tooling](#developer-tooling)
* [Web Inspector](#web-inspector)
* [Safari Web Extensions](#safari-web-extensions)
* [Safari Content Blockers](#safari-content-blockers)
* [New Restrictions in Lockdown Mode](#new-restrictions-in-lockdown-mode)
* [More Improvements](#more-improvements)
* [Bug Fixes](#bug-fixes)
* [Feedback](#feedback)</menuitem></menu>

Today, we’re thrilled to tell you about the many additions to WebKit that are included in Safari 16.4. This release is packed with 135 new web features and over 280 polish updates. Let’s take a look.

You can experience Safari 16.4 on [macOS Ventura](https://www.apple.com/macos/ventura/), macOS Monterey, macOS Big Sur, [iPadOS 16](https://www.apple.com/ipados/ipados-16/), and [iOS 16](https://www.apple.com/ios/ios-16/). Update to Safari 16.4 on macOS Monterey or macOS Big Sur by going to System Preferences → Software Update → More info, and choosing to update Safari. Or update on macOS Ventura, iOS or iPadOS, by going to Settings → General → Software Update.

## Web Push on iOS and iPadOS

![](https://webkit.org/wp-content/uploads/Web_Push_on_iOS.png)

iOS and iPadOS 16.4 add support for Web Push to web apps added to the Home Screen. Web Push makes it possible for web developers to send push notifications to their users through the use of [Push API](https://developer.mozilla.org/docs/Web/API/Push_API), [Notifications API](https://developer.mozilla.org/docs/Web/API/Notifications_API), and [Service Workers](https://developer.mozilla.org/docs/Web/API/Service_Worker_API).

Deeply integrated with iOS and iPadOS, Web Push notifications from web apps work exactly like notifications from other apps. They show on the Lock Screen, in Notification Center, and on a paired Apple Watch. [Focus](https://support.apple.com/HT212608) provides ways for users to precisely configure when or where to receive Web Push notifications — putting users firmly in control of the experience. For more details, read [*Web Push for Web Apps on iOS and iPadOS*](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

## Improvements for Web Apps

WebKit on iOS and iPadOS 16.4 adds support for the [Badging API](https://developer.mozilla.org/docs/Web/API/Badging_API). It allows web app developers to display an app badge count just like any other app on iOS or iPadOS. Permission for a Home Screen web app to use the Badging API is automatically granted when a user gives permission for notifications.

To support notifications and badging for multiple installs of the same web app, WebKit adds support for the [`id` member](https://developer.mozilla.org/docs/Web/Manifest/id) of the [Web Application Manifest](https://www.w3.org/TR/appmanifest/) standard. Doing so continues to provide users the convenience of saving multiple copies of a web app, perhaps logged in to different accounts separating work and personal usage — which is especially powerful when combined with the ability to customize Home Screen pages with different sets of apps for each [Focus](https://support.apple.com/HT212608).

iOS and iPadOS 16.4 also add support so that third-party web browsers can offer “Add to Home Screen” in the Share menu. For the details on how browsers can implement support, as well more information about all the improvements to web apps, read [*Web Push for Web Apps on iOS and iPadOS*](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)*.*

We continue to care deeply about both the needs of a wide-range of web developers and the everyday experience of users. Please keep sending us your [ideas and requests](#feedback). There’s more work to do, and we couldn’t be more excited about where this space is headed.

## Web Components

[Web Components](https://developer.mozilla.org/docs/Web/Web_Components) is a suite of technologies that together make it possible to create reusable custom HTML elements with encapsulated functionality. Safari 16.4 improves support for Web Components with several powerful new capabilities.

Safari 16.4 adds support Declarative Shadow DOM, allowing developers to define [shadow DOM](https://developer.mozilla.org/docs/Web/Web_Components/Using_shadow_DOM) without the use of JavaScript. And it adds support for [`ElementInternals`](https://developer.mozilla.org/docs/Web/API/ElementInternals), providing the basis for improved accessibility for web components, while enabling custom elements to participate in forms alongside built-in form elements.

Also, there’s now support for the Imperative Slot API. Slots define where content goes in the template of a custom element. The Imperative Slot API allows developers to specify the assigned node for a slot element in JavaScript for additional flexibility.

## CSS

Safari 16.4 adds support for quite a few new CSS properties, values, pseudo-classes and syntaxes. We are proud to be leading the way in several areas to the future of graphic design on the web.

### Margin Trim

The [`margin-trim`](https://developer.mozilla.org/docs/Web/CSS/margin-trim) property can be used to eliminate margins from elements that are abutting their container. For example, imagine we have a `section` element, and inside it we have content consisting of an `h2` headline and several paragraphs. The section is styled as a card, with an off-white background and some padding. Like usual, the headline and paragraphs all have top and bottom margins — which provide space between them. But we actually don’t want a margin above the first headline, or after the last paragraph. Those margins get added to the padding, and create more space than what’s desired.

![](https://webkit.org/wp-content/uploads/before-margin-trim.png)

Here’s an example of a simple card, with headline and paragraph text. On the left is the result. On the right, the same exact layout, but with the container’s padding marked in green, and the children’s margins marked in orange. Note there are margins above the first line of text, and the below the last line of text.

Often web developers handle this situation by removing the top margin on the headline with `h2 { margin-block-start: 0 }` and the bottom margin on the last paragraph with `p:last-child { margin-block-end: 0 }` — and hoping for the best. Problems occur, however, when unexpected content is placed in this box. Maybe another instance starts with an `h3`, and no one wrote code to remove the top margin from that `h3`. Or a second `h2` is written into the text in the middle of the box, and now it’s missing the top margin that it needs.

The `margin-trim` property allows us to write more robust and flexible code. We can avoid removing margins from individual children, and instead put `margin-trim: block` on the container.

```
section {
  margin-trim: block;
}
```

![](https://webkit.org/wp-content/uploads/after-margin-trim.png)

The same simple content card example, but with margin-trim applied. Note that there is no longer a margin above the first line of text or below the last.

This communicates to the browser: please trim away any margins that butt up against the container. The rule `margin-trim: block` trims margins in the block direction, while `margin-trim: inline` trims margins in the inline direction.

Try [this demo](https://codepen.io/jensimmons/pen/zYJpVYK/137399c77d742fccea782b56ad486df0) for yourself in Safari 16.4 or [Safari Technology Preview](https://developer.apple.com/safari/technology-preview/) to see the results.

### Typography

Safari 16.4 also adds support for the new line height and root line height units, `lh` and `rlh`. Now you can set any measurement relative to the line-height. For example, perhaps you’d like to set the margin above and below your paragraphs to match your line-height.

```
p {
  font-size: 1.4rem;
  line-height: 1.2;
  margin-block: 1lh;
}
```

The `lh` unit references the current line-height of an element, while the `rlh` unit references the root line height — much like em and rem.

Safari 16.4 adds support for [`font-size-adjust`](https://developer.mozilla.org/docs/Web/CSS/font-size-adjust). This CSS property provides a way to preserve the apparent size and readability of text when different fonts are being used. While a web developer can tell the browser to typeset text using a specific font size, the reality is that different fonts will render as different visual sizes. You can especially see this difference when more than one font is used in a single paragraph. In the [following demo](https://codepen.io/jensimmons/pen/xxaJZKV/57f033eb4e2e65eadce5771676e27b66?editors=1100), the body text is set with a serif font, while the code is typeset in a monospace font — and they do not look to be the same size. The resulting differences in x-height can be quite disruptive to reading. The demo also provides a range of font fallback options for different operating systems, which introduces even more complexity. Sometimes the monospace font is bigger than the body text, and other times it’s smaller, depending on which font family is actually used. The `font-size-adjust` property gives web developers a solution to this problem. In this case, we simply write `code { font-size-adjust: 0.47; }` to ask the browser to adjust the size of the code font to match the actual glyph size of the body font.

![](https://webkit.org/wp-content/uploads/font-size-adjust.png)

Open [this demo](https://codepen.io/jensimmons/pen/xxaJZKV/57f033eb4e2e65eadce5771676e27b66?editors=1100) in [Safari 16.4, Safari Technology Preview or Firefox](https://caniuse.com/font-size-adjust) to see `font-size-adjust` in action.

To round out support for the [font size](https://developer.mozilla.org/docs/Web/CSS/font-size) keywords, `font-size: xxx-large` is now supported in Safari 16.4.

### Pseudo-classes

Safari 16.4 also adds support for several new pseudo-classes. Targeting a particular text direction, the [`:dir()`](https://developer.mozilla.org/docs/Web/CSS/:dir) pseudo-class lets you define styles depending on whether the language’s script flows `ltr` (left-to-right) or `rtl` ([right-to-left](https://www.w3.org/International/questions/qa-scripts.en.html)). For example, perhaps you want to rotate a logo image a bit to the left or right, depending on the text direction:

```
img:dir(ltr) { rotate: -30deg; }
img:dir(rtl) { rotate: 30deg; }
```

Along with unprefixing the Fullscreen API (see below), the CSS [`:fullscreen`](https://developer.mozilla.org/docs/Web/CSS/:fullscreen) pseudo-class is also now unprefixed. And in Safari 16.4, the [`:modal`](https://developer.mozilla.org/docs/Web/CSS/:modal) pseudo-class also matches fullscreen elements.

Safari 16.4 adds `:has()` support for the [`:lang`](https://developer.mozilla.org/docs/Web/CSS/:lang) pseudo-class, making it possible to style any part of a page when a particular language is being used on that page. In addition, the following media pseudo-classes now work dynamically inside of [`:has()`](https://developer.mozilla.org/docs/Web/CSS/:has), opening up a world of possibilities for styling when audio and video are in different states of being played or manipulated — [`:playing`](https://developer.mozilla.org/docs/Web/CSS/:playing), [`:paused`](https://developer.mozilla.org/docs/Web/CSS/:paused), `:seeking`, `:buffering`, `:stalled`, [`:picture-in-picture`](https://developer.mozilla.org/docs/Web/CSS/:picture-in-picture), `:volume-locked`, and `:muted`. To learn more about `:has()`, read [*Using :has() as a CSS Parent Selector and much more*](https://webkit.org/blog/13096/css-has-pseudo-class/).

### Color

Safari 16.4 adds support for Relative Color Syntax. It provides a way to specify a color value in a much more dynamic fashion. Perhaps you want to use a hexadecimal value for blue, but make that color translucent — passing it into the `hsl` color space to do the calculation.

```
section { background: hsl(from #1357a6 h s l / 0.5); }
```

Or maybe you want to define a color as a variable, and then adjust that color using a mathematical formula in the `lch` color space, telling it to cut the lightness (`l`) in half with `calc(l / 2)`, while keeping the chroma (`c`) and hue (`h`) the same.

```
:root { 
    --color: green; 
}
.component {
    --darker-accent: lch(from var(--color) calc(l / 2) c h);
}
```

Relative Color Syntax is powerful. Originally appearing in Safari Technology Preview 122 in Feb 2021, we’ve been waiting for the CSS Working Group to complete its work so we could ship. There isn’t documentation on MDN or Can I Use about Relative Color Syntax yet, but likely will be soon. Meanwhile the [Color 5 specification](https://drafts.csswg.org/css-color-5/#relative-colors) is the place to learn all about it.

Last December, Safari 16.2 added support for [`color-mix()`](https://developer.mozilla.org/docs/Web/CSS/color_value/color-mix). Another new way to specify a color value, the functional notation of `color-mix` makes it possible to tell a browser to mix two different colors together, using a certain [color space](https://developer.mozilla.org/docs/Web/CSS/color_value).

Safari 16.4 adds support for using [`currentColor`](https://developer.mozilla.org/docs/Web/CSS/color_value#currentcolor_keyword) with `color-mix()`. For example, let’s say we want to grab whatever the current text color might be, and mix 50% of it with white to use as a hover color. And we want the mathematical calculations of the mixing to happen in the [`oklab`](https://en.wikipedia.org/wiki/CIELAB_color_space) color space. We can do exactly that with:

```
:hover {
    color: color-mix(in oklab, currentColor 50%, white);
}
```

Safari 16.2 also added support for Gradient Interpolation Color Spaces last December. It allows the interpolation math of gradients — the method of determining intermediate color values — to happen across different color spaces. This illustration shows the differences between the default sRGB interpolation compared to interpolation in `lab` and `lch` color spaces:

![](https://webkit.org/wp-content/uploads/color-space-gradient-scaled.webp)

Safari 16.4 adds support for the [new system color keywords](https://developer.mozilla.org/docs/Web/CSS/system-color). Think of them as variables which represent the default colors established by the user, browser, or OS — defaults that change depending on whether the system is set to light mode, dark mode, high contrast mode, etc. For instance, `Canvas` represents the current default background color of the HTML page. Use system color keywords just like other named colors in CSS. For example, `h4 { color: FieldText; }` will style `h4` headlines to match the default color of text inside form fields. When a user switches from light to dark mode, the `h4` color will automatically change as well. Find the full list of [system colors in CSS Color level 4](https://drafts.csswg.org/css-color/#css-system-colors).

### Media Queries Syntax Improvements

Safari 16.4 adds support for the [syntax improvements](https://developer.mozilla.org/docs/Web/CSS/Media_Queries/Using_media_queries#syntax_improvements_in_level_4) from Media Queries level 4. Range syntax provides an alternative way to write out a range of values for width or height. For example, if you want to define styles that are applied when the browser viewport is between 400 and 900 pixels wide, in the original Media Query syntax, you would have written:

```
@media (min-width: 400px) and (max-width: 900px) {
  ...
}
```

Now with the new syntax from Media Queries level 4, you can instead write:

```
@media (400px <= width < 900px) {
  ...
}
```

This is the same range syntax that’s been part of Container Queries from its beginning, which shipped in [Safari 16.0](https://webkit.org/blog/13152/webkit-features-in-safari-16-0/).

Media Queries level 4 also brings more understandable syntax for combining queries using boolean logic with `and`, `not`, and `or`. For example:

```
@media (min-width: 40em), (min-height: 20em) {
  @media not all and (pointer: none) { 
    ... 
  }
}
```

Can instead be greatly simplified as:

```
@media ((min-width: 40em) or (min-height: 20em)) and (not (pointer: none)) {
  ... 
}
```

Or, along with the range syntax changes, as:

```
@media ((40em < width) or (20em < height)) and (not (pointer: none)) {
  ...
}
```

### Custom Properties

Safari 16.4 adds support for CSS Properties and Values API with support for the [`@property`](https://developer.mozilla.org/docs/Web/CSS/@property) at-rule. It greatly extends the capabilities of CSS variables by allowing developers to specify the syntax of the variable, the inheritance behavior, and the variable initial value — similar to how browser engines define CSS properties.

```
@property --size {
  syntax: "<length>";
  initial-value: 0px;
  inherits: false;
}
```

With `@property` support, developers can to do things in CSS that were impossible before, like animate gradients or specific parts of transforms.

### Web Animations

Safari 16.4 includes some additional improvements for web animations. You can animate custom properties. Animating the blending of mismatched filter lists is now supported. And Safari now supports `KeyframeEffect.iterationComposite`.

### Outline + Border Radius

Until now, if a web developer styled an element that had an `outline` with a custom `outline-style`, and that element had curved corners, the outline would not follow the curve in Safari. Now in Safari 16.4, `outline` always follows the curve of `border-radius`.

### CSS Typed OM

Safari 16.4 adds support for [CSS Typed OM](https://developer.mozilla.org/docs/Web/API/CSS_Typed_OM_API/Guide), which can be used to expose CSS values as typed JavaScript objects. Input validation for `CSSColorValues` is also supported as part of CSS Typed OM. Support for [Constructible and Adoptable `CSSStyleSheet` objects](https://w3c.github.io/csswg-drafts/cssom-1/#css-object-model) also comes to Safari 16.4.

## HTML

Safari 16.4 now supports [lazy loading](https://developer.mozilla.org/docs/Web/Performance/Lazy_loading) iframes with `loading="lazy"`. You might put it on a video embed iframe, [for example](https://codepen.io/jensimmons/pen/eYLgmgE/0f13453f284ddca8c30122c77784295f?editors=1100), to let the browser know if this element is offscreen, it doesn’t need to load until the user is about to scroll it into view.

```
<iframe src="videoplayer.html" title="This Video" 
        loading="lazy" width="640" height="360" ></iframe>
```

By the way, you should always include the height and width attributes on iframes, so browsers can reserve space in the layout for it before the iframe has loaded. If you resize the iframe with CSS, be sure to define both width and height in your CSS. You can also use the [`aspect-ratio`](https://developer.mozilla.org/docs/Web/CSS/aspect-ratio) property to make sure an iframe keeps it’s shape as it’s resized by CSS.

```
iframe { 
    width: 100%; 
    height: auto; 
    aspect-ratio: 16 / 9; 
}
```

Now in Safari 16.4, a gray line no longer appears to mark the space where a lazy-loaded image will appear once it’s been loaded.

Safari 16.4 also includes two improvements for `<input type="file">`. Now a thumbnail of a selected file will appear on macOS. And the `cancel` event is supported.

## JavaScript and WebAssembly

Safari 16.4 brings a number of useful new additions for developers in JavaScript and WebAssembly.

RegExp Lookbehind makes it possible to write Regular Expressions that check what’s before your regexp match. For example, match patterns like `(?<=foo)bar` matches `bar` only when there is a `foo` before it. It works for both positive and negative lookbehind.

JavaScript Import Maps give web developers the same sort of versioned file mapping used in other module systems, without the need for a build step.

[Growable `SharedArrayBuffer`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer#growing_sharedarraybuffers) provided a more efficient mechanism for growing an existing buffer for generic raw binary data. And [resizable `ArrayBuffer`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer) allows for resizing of a byte array in JavaScript.

In WebAssembly, we’ve added support for 128-bit SIMD.

Safari 16.4 also includes:

* `Array.fromAsync`
* `Array#group` and `Array#groupToMap`
* `Atomics.waitAsync`
* `import.meta.resolve()`
* `Intl.DurationFormat`
* `String#isWellFormed` and `String#toWellFormed`
* class static initialization blocks
* `Symbols` in `WeakMap` and `WeakSet`

## Web API

Safari 16.4 adds support for quite a few new Web API. We prioritized the features you’ve told us you need most.

### Offscreen Canvas

When using Canvas, the rendering, animation, and user interaction usually happens on the main execution thread of a web application. [Offscreen Canvas](https://developer.mozilla.org/docs/Web/API/OffscreenCanvas) provides a canvas that can be rendered off screen, decoupling the DOM and the Canvas API so that the `<canvas>` element is no longer entirely dependent on the DOM. Rendering can now also be transferred to a worker context, allowing developers to run tasks in a separate thread and avoid heavy work on the main thread that can negatively impact the user experience. The combination of DOM-independent operations and rendering of the main thread can provide a significantly better experience for users, especially on low-power devices. In Safari 16.4 we’ve added Offscreen Canvas support for 2D operations. Support for 3D in Offscreen Canvas is in development.

### Fullscreen API

Safari 16.4 now supports the updated and unprefixed [Fullscreen API](https://developer.mozilla.org/docs/Web/API/Fullscreen_API) on macOS and iPadOS. Fullscreen API provides a way to present a DOM element’s content so that it fills the user’s entire screen, and to exit fullscreen mode once it’s unneeded. The user is given control over exiting fullscreen mode through various mechanisms, include pressing the ‘Esc’ key on the keyboard, or performing a downwards gesture on touch-enabled devices. This ensures that the user always has the ability to exit fullscreen whenever they desire, preserving their control over the browsing experience.

### Screen Orientation API

Along with the Fullscreen API we’ve added preliminary support for [Screen Orientation API](https://developer.mozilla.org/docs/Web/API/ScreenOrientation) in Safari 16.4, including:

* `ScreenOrientation.prototype.type` returns the screen’s current orientation.
* `ScreenOrientation.prototype.angle` returns the screen’s current orientation angle.
* `ScreenOrientation.prototype.onchange` event handler, which fires whenever the screen changes orientation.

Support for the `lock()` and `unlock()` methods remain experimental features for the time being. If you’d like to try them out, you can enable them in the Settings app on iOS and iPadOS 16.4 via Safari → Advanced → Experimental Features → Screen Orientation API (Locking / Unlocking).

### Screen Wake Lock API

The [Screen Wake Lock API](https://developer.mozilla.org/docs/Web/API/Screen_Wake_Lock_API) provides a mechanism to prevent devices from dimming or locking the screen. The API is useful for any application that requires the screen to stay on for an extended period of time to provide uninterrupted user experience, such as a cooking site, or for displaying a QR code.

### User Activation API

[User Activation API](https://developer.mozilla.org/docs/Web/API/UserActivation) provides web developers with a means to check whether a user meaningfully interacted with a web page. This is useful as some APIs require meaningful “user activation”, such as, a click or touch, before they can be used. Because user activation is based on a timer, the API can be used to check if document currently has user activation as otherwise a call to an API would fail. Read [*The User Activation API*](https://webkit.org/blog/13862/the-user-activation-api/) for more details and usage examples.

### WebGL Canvas Wide Gamut Color

WebGL canvas now supports the `display-p3` wide-gamut color space. To learn more about color space support, read [*Improving Color on the Web*](https://webkit.org/blog/6682/improving-color-on-the-web/), [*Wide Gamut Color in CSS with Display-P3*](https://webkit.org/blog/10042/wide-gamut-color-in-css-with-display-p3/), and [*Wide Gamut 2D Graphics using HTML Canvas*](https://webkit.org/blog/12058/wide-gamut-2d-graphics-using-html-canvas/).

### Compression Streams API

[Compression Streams API](https://developer.mozilla.org/docs/Web/API/Compression_Streams_API) allows for compressing and decompressing streams of data in directly in the browser, reducing the need for a third-party JavaScript compression library. This is handy if you need to “gzip” a stream of data to send to a server or to save on the user’s device.

### And more

Safari 16.4 also includes many other new Web API features, including:

* Reporting API
* Notification API in dedicated workers
* Permissions API for dedicated workers
* Service Workers and Shared Workers to the Permissions API
* `gamepad.vibrationActuator`
* A submitter parameter in the FormData constructor
* COEP violation reporting
* COOP/COEP navigation violation reporting
* Fetch Initiator
* Fetch Metadata Request Headers
* importing compressed EC keys in WebCrypto
* loading scripts for nested workers
* non-autofill credential type for the `autocomplete` attribute
* revoking Blob URLs across same-origin contexts
* `isComposing` attribute on InputEvent
* termination of nested workers
* transfer size metrics for first parties in `ServerTiming` and `PerformanceResourceTiming`
* `KeyframeEffect.iterationComposite`
* `WEBGL_clip_cull_distance`

## Images, Video, and Audio

Last fall, Safari 16 brought support for AVIF images to iOS 16, iPadOS 16 and macOS Ventura. Now with Safari 16.4, AVIF is also supported on macOS Monterey and macOS Big Sur. Updates to our AVIF implementation ensure animated images and images with film grain (noise synthesis) are now fully supported, and that AVIF works inside the `<picture>` element. We’ve also updated our AVIF implementation to be more lenient in accepting and displaying images that don’t properly conform to the AVIF standard.

Safari 16.4 adds support for the video portion of [Web Codecs API](https://developer.mozilla.org/docs/Web/API/WebCodecs_API). This gives web developers complete control over how media is processed by providing low-level access to the individual frames of a video stream. It’s especially useful for applications that do video editing, video conferencing, or other real-time processing of video.

Media features new to Safari 16.4 also include:

* Improvements to audio quality for web video conferencing
* Support for a subset of the AudioSession Web API
* Support for AVCapture virtual cameras
* Support for inbound rtp `trackIdentifier` stat field
* Support for VTT-based extended audio descriptions
* Support to allow a site to provide an “alternate” URL to be used during AirPlay

## WKWebView

`WKPreferences`, used by `WKWebView` on iOS and iPadOS 16.4, adds a new [`shouldPrintBackgrounds`](https://developer.apple.com/documentation/webkit/wkpreferences/4104043-shouldprintbackgrounds) API that allows clients to opt-in to including a pages’s background when printing.

## Developer Tooling

### Inspectable WebKit and JavaScriptCore API

Across all platforms supporting [`WKWebView`](https://developer.apple.com/documentation/webkit/wkwebview/4111163-isinspectable) or [`JSContext`](https://developer.apple.com/documentation/javascriptcore/jscontext/4111147-isinspectable/), a new property is available called `isInspectable` (`inspectable` in Objective-C) on macOS 13.4 and iOS, iPadOS, and tvOS 16.4. It defaults to `false`, and you can set it to `true` to opt-in to content being inspectable using Web Inspector, even in release builds of apps.

<picture><source />![Develop Menu > Patrick&#039;s iPhone > Example App](https://webkit.org/wp-content/uploads/Inspectable-Light.png)</picture>

When an app has enabled inspection, it can be inspected from Safari’s Develop menu in the submenu for either the current computer or an attached device. For iOS and iPadOS, you must also have enabled Web Inspector in the Settings app under **Safari** > **Advanced** > **Web Inspector**.

To learn more, read [*Enabling the Inspection of Web Content in Apps*](https://webkit.org/blog/13936/enabling-the-inspection-of-web-content-in-apps/).

### WebDriver

When automating Safari 16.4 with [`safaridriver`](https://developer.apple.com/documentation/webkit/about_webdriver_for_safari), we now supports commands for getting elements inside shadow roots, as well as accessibility commands for getting the computed role and label of elements. When adding a cookie with `safaridriver`, the `SameSite` attribute is now supported. Improvements have also been made to performing keyboard actions, including better support for modifier keys behind held and support for typing characters represented by multiple code points, including emoji. These improvements make writing cross-browser tests for your website even easier.

## Web Inspector

### Typography Tooling

Web Inspector in Safari 16.4 adds new typography inspection capabilities in the Fonts details sidebar of the Elements Tab.

<picture><source />![](https://webkit.org/wp-content/uploads/fonts-synthesized-warning-light.png)</picture>

Warnings are now shown for synthesized bold and oblique when the rendering engine has to generate these styles for a font that doesn’t provide a suitable style. This may be an indicator that the font file for a declared `@font-face` was not loaded. Or it may be that the specific value for `font-weight` or `font-style` isn’t supported by the used font.

A [variable font](https://developer.mozilla.org/docs/Web/CSS/CSS_Fonts/Variable_Fonts_Guide) is a font format that contains instructions on how to generate, from a single file, multiple style variations, such as weight, stretch, slant, optical sizing, and others. Some variable fonts allow for a lot of fine-tuning of their appearance, like the stroke thickness, the ascender height or descender depth, and even the curves or roundness of particular glyphs. These characteristics are expressed as variation axes and they each have a custom value range defined by the type designer.

<picture><source />![](https://webkit.org/wp-content/uploads/fonts-editable-axes-light.png)</picture>

The Fonts details sidebar now provides interactive controls to adjust values of variation axes exposed by a variable font and see the results live on the inspected page allowing you to get the font style that’s exactly right for you.

### Tooling for Conditionals in CSS

The controls under the new User Preference Overrides popover in the Elements Tab allow you to emulate the states of media features like [`prefers-reduced-motion`](https://developer.mozilla.org/docs/Web/CSS/@media/prefers-reduced-motion) and [`prefers-contrast`](https://developer.mozilla.org/docs/Web/CSS/@media/prefers-contrast) to ensure that the web content you create adapts to the user’s needs. The toggle to emulate the states of `prefers-color-scheme`, which was previously a standalone button, has moved to this new popover.

<picture><source />![](https://webkit.org/wp-content/uploads/preference-overrides-2-light.png)</picture>

<picture><source />![](https://webkit.org/wp-content/uploads/WI_EditableCSSGroupings_Light.png)</picture>

The Styles panel of the Elements Tab now allows editing the condition text for [`@media`](https://developer.mozilla.org/docs/Web/CSS/@media), [`@container`](https://developer.mozilla.org/docs/Web/CSS/@container) and [`@supports`](https://developer.mozilla.org/docs/Web/CSS/@supports) CSS rules. This allows you to make adjustments in-context and immediately see the results on the inspected page. Here’s a quick tip: edit the condition of `@supports` to its inverse, like `@supports not (display: grid)`, to quickly check your progressive enhancement approach to styling and layout.

### Badging HTML Elements

<picture><source />![](https://webkit.org/wp-content/uploads/WI_Badges_Light.png)</picture>

New badges for elements in the DOM tree of the Elements Tab join the existing badges for Grid and Flex containers. The new Scroll badge calls out scrollable elements, and the new Events badge provides quick access to the event listeners associated with the element when clicked. And a new Badges toolbar item makes it easy to show just the badges you are interested in and hide others.

### And more

Changes to Web Inspector in Safari 16.4 also include:

* Elements Tab: Improved visual hierarchy of the Layout sidebar.
* Elements Tab: Added support for nodes that aren’t visible on the page to appear dimmed in the DOM tree.
* Console Tab: Added support for console snippets.
* Sources Tab: Added showing relevant special breakpoints in the Pause Reason section.
* Sources Tab: Added support for inline breakpoints.
* Sources Tab: Added support for symbolic breakpoints
* Network Tab: Added a Path column.
* Network Tab: Added alphabetic sorting of headers.
* Network Tab: Added support for per-page network throttling.
* Network Tab: Added using the Shift key to highlight the initiator or initiated resources.
* Graphics Tab: Added OpenGL object IDs in the Canvas inspector.
* Settings Tab: Added a setting to turn off dimming nodes that aren’t visible on the page.
* Added support for function breakpoints and tracepoints.

## Safari Web Extensions

### Enhancements to Declarative Net Request

Safari is always working on improving support for [`declarativeNetRequest`](https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/API/declarativeNetRequest), the declarative way for web extensions to block and modify network requests. In Safari 16.4, several enhancements have been added to the API:

* The `declarativeNetRequest.setExtensionActionOptions` API can be used to configure whether to automatically display the action count (number of blocked loads, etc.) as the extension’s badge text.
* The `modifyHeaders` action type has been added to rewrite request and response headers. This action requires granted website permissions for the affected domains and the `declarativeNetRequestWithHostAccess` permission in the manifest.
* The `redirect` action type now requires the `declarativeNetRequestWithHostAccess` permission in the manifest.
* The `MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES` property has been added to check the maximum number of combined dynamic and session rules an extension can add. The current limit is set at 5,000 rules.

These enhancements give developers more options to customize their content blocking extensions and provide users with better privacy protection.

### SVG Icon Support in Web Extensions

Safari 16.4 now supports SVG images as extension and action icons, giving developers more options for creating high-quality extensions. This support brings Safari in line with Firefox, allowing for consistent experiences across platforms. The ability to scale vector icons appropriately for any device means developers no longer need multiple sizes, simplifying the process of creating polished and professional-looking extensions.

### Dynamic Content Scripts

Safari 16.4 introduces support for the new [`scripting.registerContentScript`](https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/API/scripting/registerContentScripts) API, which enables developers to create dynamic content scripts that can be registered, updated, or removed programmatically. This API augments the static content scripts declared in the extension manifest, providing developers with more flexibility in managing content scripts and enabling them to create more advanced features for their extensions.

### Toggle Reader Mode

The [`tabs.toggleReaderMode`](https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/API/tabs/toggleReaderMode) API has been added to Safari 16.4, which enables extensions to toggle Reader Mode for any tab. This function is particularly useful for extensions that want to enhance the user’s browsing experience by allowing them to focus on the content they want to read. By using this API, developers can create extensions that automate the process of enabling Reader Mode for articles, making it easier and more convenient for users to read online content.

### Session Storage

The [`storage.session`](https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/API/storage/session) API, now supported in Safari 16.4, enables extensions to store data in memory for the duration of the browser session, making it a useful tool for storing data that takes a long time to compute or is needed quickly between non-persistent background page loads. This API is particularly useful for storing sensitive or security-related data, such as decryption keys or authentication tokens, that would be inappropriate to store in local storage. The session storage area is not persisted to disk and is cleared when Safari quits, providing enhanced security and privacy for users.

### Background Modules

Developers can now take advantage of modules in background service workers and pages by setting `"type": "module"` in the `background` section of the manifest. This allows for more organized and maintainable extension code, making it easier to manage complex codebases. By setting this option, background scripts will be loaded as ES modules, enabling the use of import statements to load dependencies and use the latest JavaScript language features.

## Safari Content Blockers

Safari 16.4 has added support for [`:has()`](https://developer.mozilla.org/docs/Web/CSS/:has) selectors in Safari Content Blocker rules. This is a powerful new addition to the declarative content blocking capabilities of Safari, as it allows developers to select and hide parent elements that contain certain child elements. Its inclusion in Safari Content Blocker rules opens up a whole new range of possibilities for content blocking. Now developers can create more nuanced and precise rules that can target specific parts of a web page, making it easier to block unwanted content while preserving the user’s browsing experience. This is yet another example of Safari’s commitment to providing a secure and private browsing experience for its users while also offering developers the tools they need to create innovative and effective extensions.

## New Restrictions in Lockdown Mode

[Lockdown Mode](https://support.apple.com/HT212650) is an optional, extreme protection that’s designed for the very few individuals who, because of who they are or what they do, might be personally targeted by some of the most sophisticated digital threats. Most people are never targeted by attacks of this nature.

If a user chooses to enable Lockdown mode on iOS 16.4, iPadOS 16.4, or macOS Ventura 13.3, Safari will now:

* Disable binary fonts in the CSS Font Loading API
* Disable Cache API
* Disable CacheStorage API
* Disable ServiceWorkers
* Disable SVG fonts
* Disable the WebLocks API
* Disable WebSpeech API

## More Improvements

Safari 16.4 now supports dark mode for plain text files. It has support for smooth key-driven scrolling on macOS. And it adds prevention of redirects to `data:` or `about:` URLs.

## Bug Fixes

In addition to the 135 new features, WebKit for Safari 16.4 includes an incredible amount work polishing existing features. We’ve heard from you that you want to know more about the many fixes going into each release of Safari. We’ve done our best to list everything that might be of interest to developers, in this case, 280 of those improvements:

### CSS

* Fixed `-webkit-mask-box-image: initial` to set the correct initial value.
* Fixed `-webkit-radial-gradient` parsing accidentally treating several mandatory commas as optional.
* Fixed `::placeholder` to not support `writing-mode`, `direction`, or `text-orientation.`
* Fixed `@supports` to not work if `not`, `or`, or `and` isn’t followed by a space.
* Fixed `background-repeat` not getting correctly exposed through inline styles.
* Fixed `baseline-shift` to allow length or percentage, but not numbers.
* Fixed `contain: inline-size` for replaced elements.
* Fixed `CSSPerspective.toMatrix()` to throw a TypeError if its length is incompatible with the `px` unit.
* Fixed `cx`, `cy`, `x`, and `y` CSS properties to allow length or percentage, but not numbers.
* Fixed `filter: blur` on an absolutely positioned image losing `overflow: hidden`.
* Fixed `font-face` to accept ranges in reverse order, and reverse them for computed styles.
* Fixed `font-style: oblique` must allow angles equal to 90deg or -90deg.
* Fixed `font-style: oblique` with `calc()` to allow out-of-range angles and clamp them for computed style.
* Fixed `font-weight` to clamp to 1 as a minimum.
* Fixed `font` shorthand to reject out-of-range angles for `font-style`.
* Fixed `font` shorthand to reset more longhand properties.
* Fixed `overflow-x: clip` causing a sibling image to not load.
* Fixed `overflow: clip` not working on SVG elements.
* Fixed `stroke-dasharray` parsing to align with standards.
* Fixed `stroke-width` and `stroke-dashoffset` parsing to align with standards.
* Fixed `text-decoration-thickness` property not repainting when changed.
* Fixed allowing `calc()` that combines percentages and lengths for `line-height`.
* Fixed an issue where using `box-sizing: border-box` causes the calculated aspect-ratio to create negative content sizes.
* Fixed an issue with a monospace font on a parent causing children with a sans-serif font using `rem` or `rlh` units to grow to a larger size.
* Fixed behavior of `cursor: auto` over links.
* Fixed buttons with auto width and height to not set intrinsic margins.
* Fixed calculating block size to use the correct box-sizing with aspect ratio.
* Fixed cells overflowing their contents when a table cell has inline children which change `writing-mode`.
* Fixed clipping `perspective``calc()` values to 0.
* Fixed font shorthand to not reject values that happen to have CSS-wide keywords as non-first identifiers in a font family name.
* Fixed hit testing for double-click selection on overflowing inline content.
* Fixed honoring the content block size minimum for a `<fieldset>` element with `aspect-ratio` applied.
* Fixed incorrectly positioned line break in contenteditable with tabs.
* Fixed invalidation for class names within `:nth-child()` selector lists.
* Fixed omitting the `normal` value for `line-height` from the `font` shorthand in the specified style, not just the computed style.
* Fixed pseudo-elements to not be treated as ASCII case-insensitive.
* Fixed rejecting a selector argument for `:nth-of-type` or `:nth-last-of-type`.
* Fixed serialization order for `contain`.
* Fixed strings not wrapped at zero width spaces when `word-break: keep-all` is set.
* Fixed supporting `<string>` as an unprefixed keyframe name.
* Fixed the `:has()` pseudo-selector parsing to be unforgiving.
* Fixed the `font-face``src` descriptor format to allow only specified formats, others are a parse error.
* Fixed the `tz` component not accounting for zoom when creating a `matrix3d`() value.
* Fixed the computed value for `stroke-dasharray` to be in `px`.
* Fixed the effect of the writing-mode property not getting removed when the property is removed from the root element.
* Fixed the position of `text-shadow` used with `text-combine-upright`.
* Fixed the title of a style element with an invalid type to never be added to preferred stylesheet set.
* Fixed the transferred min/max sizes to be constrained by defined sizes for aspect ratio.
* Fixed the user-agent stylesheet to align hidden elements, `abbr`, `acronym`, `marquee`, and `fieldset` with HTML specifications.
* Fixed to always use percentages for computed values of `font-stretch`, never keywords.
* Fixed to not require whitespace between `of` and the selector list in `:nth-child` or `:nth-last-child`.

### CSS API

* Fixed `CSS.supports` returning false for custom properties.
* Fixed `CSS.supports` whitespace handling with `!important`.
* Fixed forgiving selectors to not be reported as supported with `CSS.supports("selector(...)")`.
* Fixed `getComputedStyle()` to return a function list for the transform property.
* Fixed `linear-gradient` keyword values not getting converted to their `rgb()` equivalents for `getComputedStyle()`.

### Content Security Policy

* Fixed updating the Content Security Policy when a new header is sent as part of a 304 response.

### Forms

* Fixed `<input type="submit">`, `<input type="reset">,` and `<input type="button">` to honor `font-size`, `padding`, `height`, and work with multi-line values.
* Fixed firing the `change` event for `<input type="file">` when a different file with the same name is selected.
* Fixed preventing a disabled `<fieldset>` element from getting focus.
* Fixed the `:out-of-range` pseudo class matching for empty `input[type=number]`.

### JavaScript

* Fixed `Array.prototype.indexOf` constant-folding to account for a non-numeric index.
* Fixed `Intl.NumberFormat``useGrouping` handling to match updated specs.
* Fixed `Intl.NumberFormat` ignoring `maximumFractionDigits` with compact notation.
* Fixed `String.prototype.includes` incorrectly returning false when the string is empty and the position is past end of the string.
* Fixed `toLocaleLowerCase` and `toLocaleUpperCase` to throw an exception on an empty string.

### HTML

* Fixed aligning the parsing of `<body link vlink alink>` to follow standards.
* Fixed `<legend>` to accept more `display` property values than `display: block`.

### Intelligent Tracking Prevention

* Fixed user initiated cross-domain link navigations getting counted as Top Frame Redirects.

### Images

* Fixed some display issues with HDR AVIF images.
* Fixed the accept header to correctly indicate AVIF support.

### Lockdown Mode

* Fixed common cases of missing glyphs due to custom icon fonts.

### Media

* Fixed `enumerateDevices` may return filtered devices even if page is capturing.
* Fixed `MediaRecorder.stop()` firing an additional `dataavailable` event with bytes after `MediaRecorder.pause()`.
* Fixed duplicate `timeupdate` events.
* Fixed limiting DOMAudioSession to third-party iframes with microphone access.
* Fixed MSE to not seek with no seekable range.
* Fixed mute microphone capture if capture fails to start because microphone is used by a high priority application.
* Fixed not allowing text selection to start on an HTMLMediaElement.
* Fixed only requiring a transient user activation for Web Audio rendering.
* Fixed screen capture to fail gracefully if the window or screen selection takes too long.
* Fixed switching to alternate `<source>` element for AirPlay when necessary.
* Fixed the local WebRTC video element pausing after bluetooth `audioinput` is disconnected.
* Fixed trying to use low latency for WebRTC HEVC encoder when available.
* Fixed unmuting a TikTok video pauses it.
* Fixed WebVTT styles not applied with in-band tracks.

### Rendering

* Ensured negative letter-spacing does not pull content outside of the inline box
* Fixed `<div>` with `border-radius` not painted correctly while using jQuery’s `.slideToggle()`.
* Fixed `border-radius` clipping on composited layers.
* Fixed `box-shadow` to paint correctly on inline elements.
* Fixed box-shadow invalidation on inline boxes.
* Fixed calculating the width of an inline text box using simplified measuring to handle fonts with `Zero Width Joiner`, `Zero Width Non-Joner`, or `Zero Width No-Break Space`.
* Fixed clearing floats added dynamically to previous siblings.
* Fixed clipping the source image when the source rectangle is outside of the source image in canvas.
* Fixed CSS keyframes names to not allow CSS wide keywords.
* Fixed elements with negative margins not avoiding floats when appropriate.
* Fixed floating boxes overlapping with their margin boxes.
* Fixed HTMLImageElement width and height to update layout to return styled dimensions not the image attributes.
* Fixed ignoring `nowrap` on `<td nowrap="nowrap">` when an absolute width is specified.
* Fixed incorrect clipping when a layer is present between the column and the content layer.
* Fixed incorrect static position of absolute positioned elements inside relative positioned containers.
* Fixed layout for fixed position elements relative to a transformed container.
* Fixed layout overflow rectangle overflows interfering with the scrollbar.
* Fixed negative shadow repaint issue.
* Fixed preventing a focus ring from being painted for anonymous block continuations.
* Fixed recalculating intrinsic widths in the old containing block chain when an object goes out of flow.
* Fixed rendering extreme `border-radius` values.
* Fixed specified hue interpolation method for hues less than 0 or greater than 360.
* Fixed tab handling in right-to-left editing.
* Fixed text selection on flex and grid box items.
* Fixed the position and thickness of underlines to be device pixel aligned.
* Fixed transforms for table sections.
* Fixed transition ellipsis box from “being a display box on the line” to “being an attachment” of the line box.
* Fixed unexpected overlapping selection with tab in right-to-left context.
* Fixed updating table rows during simplified layout.
* Fixed: improved balancing for border, padding, and empty block content.

### Safari Web Extensions

* Extensions that request the `unlimitedStorage` permission no longer need to also request `storage`.
* Fixed `browser.declarativeNetRequest` namespace is now available when an extension has the `declarativeNetRequestWithHostAccess` permission.
* Fixed `isUrlFilterCaseSensitive``declarativeNetRequest` rule condition to be `false` by default.
* Fixed `tabs.onUpdated` getting called on tabs that were already closed.
* Fixed background service worker failing to import scripts.
* Fixed content scripts not injecting into subframes when extension accesses the page after a navigation.
* Fixed CORS issue when doing fetch requests from a background service worker.
* Fixed `declarativeNetRequest` errors not appearing correctly in the extension’s pane of Safari Settings.
* Fixed display of extension cookie storage in Web Inspector. Now the extension name is shown instead of a UUID.
* Fixed `declarativeNetRequest` rules not loading when an extension is turned off and then on.
* Fixed result of `getMatchedRules()` to match other browsers.
* Fixed `browser.webNavigation` events firing for hosts where the extension did not have access.
* Removed Keyboard Shortcut conflict warnings for `browser.commands` when there are multiple commands without keyboard shortcuts assigned.

### Scrolling

* Fixed `overscroll-behavior: none` to prevent overscroll when the page is too small to scroll.

### SVG

* Fixed `<svg:text>` to not auto-wrap.
* Fixed `preserveAspectRatio` to stop accepting `defer`.
* Fixed `SVG.currentScale` to only set the page zoom for a standalone SVG.
* Fixed `svgElement.setCurrentTime` to restrict floats to finite values.
* Fixed applying changes to `fill` with `currentColor` to other colors via CSS.
* Fixed changes to the `filter` property getting ignored.
* Fixed CSS and SVG filters resulting in a low quality, pixelated image.
* Fixed focusability even when tab-to-links is enabled for `<svg:a>`.
* Fixed handling animation freezes when `repeatDur` is not a multiple of `dur`.
* Fixed making sure computed values for `baseline-shift` CSS property use `px` unit for lengths.

### Tables

* Fixed not forcing `display: table-cell`, `display: inline-table`, `display: table`, and `float: none` on table cell elements when in quirks mode.
* Fixed removing the visual border when the table border attribute is removed.

### Text

* Fixed `font-optical-sizing: auto` having no effect in Safari 16.
* Fixed directionality of the `<bdi>` and `<input>` elements to align with HTML specifications.
* Fixed handling an invalid `dir` attribute to not affect directionality.
* Fixed the default oblique angle from `20deg` to `14deg`.
* Fixed the handling of `<bdo>`.
* Fixed the order of how `@font-palette-values``override-colors` are applied.

### Web Animations

* Fixed `@keyframes` rules using an `inherit` value to update the resolved value when the parent style changes.
* Fixed `Animation.commitStyles()` triggering a mutation even when the styles are unchanged.
* Fixed `Animation.startTime` and `Animation.currentTime` setters support for CSSNumberish values.
* Fixed `baseline-shift` animation.
* Fixed `baselineShift` inherited changes.
* Fixed `commitStyles()` failing to commit a relative `line-height` value.
* Fixed `getKeyframes()` serialization of CSS values for an `onkeyframe` sequence.
* Fixed `rotate: x` and `transform: rotate(x)` to yield the same behavior with SVGs.
* Fixed `word-spacing` to support animating between percentage and fixed values.
* Fixed accounting for non-inherited CSS variables getting interpolated for standard properties on the same element.
* Fixed accumulating and clamping filter values when blending with `"none"`.
* Fixed accumulation support for the `filter` property.
* Fixed additivity support for the `filter` property.
* Fixed animation of color list custom properties with `iterationComposite`.
* Fixed blend transform when iterationComposite is set to `accumulate`.
* Fixed blending to account for `iterationComposite`.
* Fixed Calculating computed keyframes for shorthand properties.
* Fixed composite animations to compute blended additive or accumulative keyframes for in-between keyframes.
* Fixed computing the `keyTimes` index correctly for discrete values animations.
* Fixed CSS animations participation in the cascade.
* Fixed custom properties to support interpolation with a single keyframe.
* Fixed filter values containing a `url()` should animate discretely.
* Fixed interpolating custom properties to take `iterationComposite` into account.
* Fixed jittering when animating a rotated image.
* Fixed keyframes to be recomputed if a custom property registration changes.
* Fixed keyframes to be recomputed if the CSS variable used is changed.
* Fixed keyframes to be recomputed when `bolder` or `lighter` is used on a `font-weight` property.
* Fixed keyframes to be recomputed when a parent element changes value for a custom property set to `inherit`.
* Fixed keyframes to be recomputed when a parent element changes value for a non-inherited property set to `inherit`.
* Fixed keyframes to be recomputed when the `currentcolor` value is used on a custom property.
* Fixed keyframes to be recomputed when the `currentcolor` value is used.
* Fixed opacity to use unclamped values for `from` and `to` keyframes with `iterationComposite`.
* Fixed running a transition on an inherited CSS variable getting reflected on a standard property using that variable as a value.
* Fixed seamlessly updating the playback rate of an animation.
* Fixed setting `iterationComposite` should invalidate the effect.
* Fixed setting the `transition-property` to `none` does not disassociate the CSS Transition from owning the element.
* Fixed the composite operation of implicit keyframes for CSS Animations to return `"replace"`.
* Fixed the timing model for updating animations and sending events.
* Fixed updating timing to invalidate the effect.

### Web API

* Fixed `-webkit-user-select: none` allowing text to be copied to clipboard.
* Fixed `contentEditable` caret getting left aligned instead of centered when the `:before` pseudo-element is used.
* Fixed `Cross-Origin-Embedder-Policy` incorrectly blocking scripts on cache hit.
* Fixed `CSSRule.type` to not return values greater than 15.
* Fixed `document.open()` to abort all loads when the document is navigating.
* Fixed `document.open()` to remove the initial `about:blank`\-ness of the document.
* Fixed `Element.querySelectorAll` not obeying element scope with ID.
* Fixed `FileSystemSyncAccessHandle` write operation to be quota protected.
* Fixed `getBoundingClientRect()` returning the wrong value for `<tr>`, `<td>`, and its descendants for a vertical table.
* Fixed `HTMLOutputElement.htmlFor` to make it settable.
* Fixed `queryCommandValue("stylewithcss")` to always return an empty string.
* Fixed `StorageEvent.initStorageEvent()` to align with HTML specifications.
* Fixed `textContent` leaving dir=auto content in the wrong direction.
* Fixed `-webkit-user-select: initial` content within `-webkit-user-select: none` should be copied
* Fixed `WorkerGlobalScope.isSecureContext` to be based on the owner’s top URL, not the owner’s URL.
* Fixed a bug where `mousedown` without `mouseup` in a frame prevents a click event in another frame.
* Fixed a sometimes incorrect location after exiting mouse hover.
* Fixed accepting `image/jpg` for compatibility.
* Fixed adding a non-breaking space, instead of a plain space, when it is inserted before an empty text node.
* Fixed behavior of nested click event on a label element with a checkbox.
* Fixed BroadcastChannel in a SharedWorker when hosted in a cross-origin iframe.
* Fixed calculation of direction for text form control elements with `dir="auto"`.
* Fixed canvas fallback content focusability computation.
* Fixed deleting a button element leaving the button’s style in a `contenteditable` element.
* Fixed disconnected `<fieldset>` elements sometimes incorrectly matching `:valid` or `:invalid` selectors.
* Fixed dragging the mouse over a `-webkit-user-select: none` node can begin selection in another node.
* Fixed ensuring nested workers get controlled if matching a service worker registration.
* Fixed errors caught and reported for `importScripts()`.
* Fixed escaping “&” in JavaScript URLs for `innerHTML` and `outerHTML`.
* Fixed EventSource to stop allowing trailing data when parsing a retry delay.
* Fixed Fetch Request object to keep its Blob URL alive.
* Fixed filled text on a canvas with a web font refreshing or disappearing.
* Fixed find on page failing to show results in PDFs.
* Fixed firing an error event when link preload fails synchronously.
* Fixed form submissions to cancel JavaScript URL navigations.
* Fixed handing the `onerror` content attribute on body and frameset elements.
* Fixed handling opaque origin Blob URLs.
* Fixed handling text documents to align to modern HTML specifications.
* Fixed handling the onerror content attribute on `<body>` and `<frameset>` elements.
* Fixed HTMLTemplateElement to have a `shadowRootMode` attribute.
* Fixed including alternate stylesheets in `document.styleSheets`.
* Fixed incorrect caret movement in some right-to-left `contenteditable` elements.
* Fixed incorrect color for videos loaded in a canvas.
* Fixed incorrect image `srcset` candidate chosen for `<img>` cloned from `<template>`.
* Fixed incorrectly ignored `X-Frame-Options` HTTP headers with an empty value.
* Fixed lazy loading images sometimes not loading.
* Fixed link elements to be able to fire more than one `load` or `error` event.
* Fixed loading Blob URLs with a fragment from opaque, unique origins.
* Fixed maintaining the original `Content-Type` header on a 303 HTTP redirect.
* Fixed module scripts to always decode using UTF-8.
* Fixed MouseEventInit to take `movementX` and `movementY`.
* Fixed not dispatching a `progress` event when reading an empty file or blob using the FileReader API.
* Fixed not replacing the current history item when navigating a cross-origin iframe to the same URL.
* Fixed overriding the mimetype for an XHR.
* Fixed parsing of negative age values in CORS prefetch responses.
* Fixed pasting of the first newline into text area.
* Fixed preventing selection for generated counters in ordered lists.
* Fixed Safari frequently using stale cached resources despite using Reload Page From Origin.
* Fixed scheduling a navigation to a Blob URL to keep the URL alive until the navigation occurs.
* Fixed sending Basic authentication via XHR using `setRequestHeader()` when there is an existing session.
* Fixed setting `style=""` to destroy the element’s inline style.
* Fixed setting the `tabIndex` of a non-focusable HTMLElement.
* Fixed system colors not respecting inherited `color-scheme` values.
* Fixed textarea placeholder text not disappearing when text is inserted without a user gesture.
* Fixed the `event.keyIdentifier` value for F10 and F11 keys.
* Fixed the click event to not get suppressed on textarea resize.
* Fixed the computed value for the `transform` property with `SkewY`.
* Fixed the initialization of color properties.
* Fixed timing of ResizeObserver and IntersectionObserver to match other browsers.
* Fixed toggling a details element when a summary element receives a `click()`.
* Fixed updating Text node children of an option element to not reset the selection of the select element.
* Fixed using NFC Security Key on iOS.
* Fixed using WebAuthn credentials registered on iOS 15 if iCloud Keychain is disabled.
* Fixed WebAuthn sending Attestation as None when requested as Direct.
* Fixed XHR aborting to align with standards specification
* Fixed XHR error events to return 0 for loaded and total.
* Fixed: Made all FileSystemSyncAccessHandle methods synchronous.
* Fixed: Removed the `precision="float"` attribute on `<input type="range">`.

### WebGL

* Fixed video textures set to repeat.

### Web Inspector

* Fixed “Inspect Element” not highlighting the element.
* Fixed capturing async stack traces for `queueMicrotask`.
* Fixed clicking coalesced events in the timeline selecting the wrong event.
* Fixed event breakpoints to support case-insensitive and RegExp matching.
* Fixed slow search with a lot of files in the Open Resource dialog.
* Fixed sorting prefixed properties below non-prefixed properties in the Computed panel of the Elements Tab.
* Fixed the always empty Attributes section in the Node panel of the Elements Tab.
* Fixed the Computed Tab scrolling to the top when a `<style>` is added to the page.
* Fixed URL breakpoints to also pause when HTML attributes are set that trigger loads.

### WebDriver

* Fixed “Get Element Rect” to not round to integer values.
* Fixed automation sessions terminating during navigation.
* Fixed click element failing on iPad when Stage Manager is disabled.
* Fixed HTTP GET requests with a body failing.
* Fixed the Shift modifier key not applying to typed text.

## Feedback

We love hearing from you. Send a tweet to [@webkit](https://twitter.com/webkit) to share your thoughts on Safari 16.4. Find us on Mastodon at [@jensimmons@front-end.social](https://front-end.social/@jensimmons) and [@jondavis@mastodon.social](https://mastodon.social/@jondavis). If you run into any issues, we welcome your [feedback](https://feedbackassistant.apple.com/) on Safari UI, or your [WebKit bug report](https://bugs.webkit.org/) about web technology or Web Inspector. Filing issues really does make a difference.

Download the latest [Safari Technology Preview](https://developer.apple.com/safari/download/) to stay at the forefront of the web platform and to use the latest Web Inspector features. You can also read the [Safari 16.4 release notes](https://developer.apple.com/documentation/safari-release-notes).