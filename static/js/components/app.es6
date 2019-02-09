/*global N*/

import SightReadingPage from "st/components/pages/sight_reading_page"
import LoginPage from "st/components/pages/login_page"
import RegisterPage from "st/components/pages/register_page"
import GuidePage from "st/components/pages/guide_pages"
import StatsPage from "st/components/pages/stats"
import FlashCardPage from "st/components/pages/flash_card_page"
import EarTrainingPage from "st/components/pages/ear_training_page"
import PlayAlongPage from "st/components/pages/play_along_page"
import LatencyPage from "st/components/pages/latency"
import SongsPage from "st/components/pages/songs"
import Header from "st/components/header"

import DevicePickerLightbox from "st/components/device_picker_lightbox"

import {dispatch, trigger} from "st/events"
import {readConfig, writeConfig} from "st/config"
import {csrfToken} from "st/globals"

import * as React from "react"
import {BrowserRouter, Route, Link, NavLink} from "react-router-dom"

import {TransitionGroup, CSSTransition} from "react-transition-group"
import {SampleOutput} from "st/sample_output"

class Layout extends React.Component {
  constructor(props) {
    super(props)
    let device = readConfig("defaults:outputDeviceType") || "none"
    let midiOutputChannel
    if (device == "internal") {
      midiOutputChannel = SampleOutput.getInstance()
    }

    this.state = {
      outputDeviceType: device,
      forwardMidi: readConfig("defaults:forwardMidi") == 1,
      midiOutputChannel
    }

    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then(
        midi => {
          this.setState({midi: midi})
          this.loadDefaultSettings()
        },
        error => console.warn("failed to get MIDI"))
    }
  }

  loadDefaultSettings() {
    let defaultMidiInput = readConfig("defaults:midiIn")
    if (defaultMidiInput) {
      let idx = 0
      for (let input of this.midiInputs()) {
        if (input.name == defaultMidiInput) {
          this.setInput(idx)
        }
        idx++
      }
    }
  }

  componentDidMount() {
    dispatch(this, {
      "lightboxClosed": e => this.setState({currentLightbox: null}),
      "closeLightbox": e => this.refs.currentLightbox.close(),
      "showLightbox": (e, lb) => {
        this.setState({
          currentLightbox: lb
        })
      },
      "pickMidi": (e) => {
        this.setState({
          currentLightbox: this.renderMidiLightbox()
        })
      }
    })
  }

  componentWillUnmount() {
    if (this.state.midiInput) {
      console.log(`Unbinding: ${this.state.midiInput.name}`)
      this.state.midiInput.onmidimessage = undefined
    }
  }

  // these are mixed into all children's props (lightboxes included)
  childProps() {
    return {
      midi: this.state.midi,
      midiInput: this.state.midiInput,
      midiOutput: this.state.midiOutputChannel,
    }
  }

  pageLayout(children) {
    return <div className="page_layout">
      <div className="header_spacer">
        {this.renderHeader()}
      </div>

      {children}

      <TransitionGroup className="lightboxes">
        {this.renderCurrentLightbox()}
      </TransitionGroup>
    </div>
  }

  renderRoutes(routes) {
    let childProps = this.childProps()

    return routes.map(({page: C, props: moreProps, path}, i) =>
      <Route key={i} exact path={path} render={
        props =>
          <C ref={comp => this.currentPage = comp} {...moreProps} {...childProps} {...props} />
      } />
    )
  }

  render() {
    return this.pageLayout(this.renderRoutes([
      { path: "/", page: SightReadingPage },
      { path: "/login", page: LoginPage },
      { path: "/register", page: RegisterPage },

      { path: "/ear-training/interval-melodies", page: EarTrainingPage, props: {
        exercise: "melody_recognition"
      }},

      { path: "/ear-training/melody-playback", page: EarTrainingPage, props: {
        exercise: "melody_playback"
      }},

      { path: "/flash-cards/note-math", page: FlashCardPage, props: {
        exercise: "note_math"
      }},

      { path: "/flash-cards/chord-identification", page: FlashCardPage, props: {
        exercise: "chord_identification"
      }},

      { path: "/play-along", page: SongsPage },
      { path: "/play-along/recent", page: SongsPage, props: {
        filter: "played"
      }},
      { path: "/stats", page: StatsPage },
      { path: "/latency", page: LatencyPage },
      { path: "/new-song", page: PlayAlongPage, props: {
        newSong: true,
        editorOpen: true,
      }},
      { path: "/song/:song_id/:song_slug", page: PlayAlongPage },

      { path: "/about", page: GuidePage, props: {
        title: "About Sight Reading Trainer",
        pageSource: "about"
      }},

      { path: "/guide/generators", page: GuidePage, props: {
        title: "Sight Reading Random Notes",
        pageSource: "generators"
      }},

      { path: "/guide/chords", page: GuidePage, props: {
        title: "Sight Reading Random Chords",
        pageSource: "chord_generators"
      }},

      { path: "/guide/lml", page: GuidePage, props: {
        title: "Programming a song with LML",
        pageSource: "lml"
      }},

      { path: "/guide/ear-training", page: GuidePage, props: {
        title: "Ear Training Tools",
        pageSource: "ear_training"
      }},
    ]))
  }

  renderCurrentLightbox() {
    if (!this.state.currentLightbox) { return }

    let lb = React.cloneElement(this.state.currentLightbox, {
      ref: "currentLightbox",
      ...this.childProps()
    })

    return <CSSTransition classNames="show_lightbox" timeout={{enter: 200, exit: 100}}>
      <div
        className="lightbox_shroud"
        onClick={(e) => {
          if (e.target.classList.contains("lightbox_shroud")) {
            this.refs.currentLightbox.close()
            e.preventDefault();
          }
        }}
        >{lb}</div>
    </CSSTransition>
  }

  doLogout() {
    let request = new XMLHttpRequest()
    request.open("POST", "/logout.json")
    let data = new FormData()
    data.append("csrf_token", csrfToken())
    request.send(data)

    request.onload = (e) => {
      let res = JSON.parse(request.responseText)
      N.init(res)
    }
  }

  renderHeader() {
    return <Header
      midiInput={this.state.midiInput}
      doLogout={this.doLogout.bind(this)}
      />
  }

  midiInputs() {
    if (!this.state.midi) return;

    var inputs = [];
    var iter = this.state.midi.inputs.values();
    for (var o = iter.next(); !o.done; o = iter.next()) {
      inputs.push(o.value);
    }
    return inputs;
  }

  setInput(idx) {
    let input = this.midiInputs()[idx]
    if (!input) { return }
    if (this.state.midiInput) {
      console.log(`Unbinding: ${this.state.midiInput.name}`)
      this.state.midiInput.onmidimessage = undefined
    }

    console.log(`Binding to: ${input.name}`)
    input.onmidimessage = this.onMidiMessage.bind(this)

    this.setState({
      midiInput: input,
      midiInputIdx: idx,
    })

    return input
  }

  onMidiMessage(message) {
    // forward to output if necessary
    if (this.state.forwardMidi && this.state.midiOutputChannel) {
      this.state.midiOutputChannel.sendMessage(message.data)
    }

    // proxy message to the current page
    if (this.currentPage && this.currentPage.onMidiMessage) {
      this.currentPage.onMidiMessage(message)
    }
  }

  renderMidiLightbox() {
    return <DevicePickerLightbox
      forwardMidi={this.state.forwardMidi}
      selectedInputIdx={this.state.midiInputIdx}
      selectedOutputChannel={this.state.midiOutputChannel}
      selectedOutputIdx={this.state.midiOutputIdx}
      selectedOutputDeviceType={this.state.outputDeviceType}

      onClose={lb => {
        let config = lb.midiConfiguration()
        let input = this.setInput(config.inputIdx)

        let output = config.outputChannel

        if (config.outputDeviceType == "internal") {
          output = SampleOutput.getInstance()
        }

        this.setState({
          forwardMidi: config.forwardMidi,
          midiOutputChannel: output,
          midiOutputIdx: config.outputIdx,
          outputDeviceType: config.outputDeviceType,
        })

        writeConfig("defaults:midiIn", input ? input.name : undefined)
        writeConfig("defaults:forwardMidi", config.forwardMidi ? "1" : undefined)
        writeConfig("defaults:outputDeviceType", config.outputDeviceType || undefined)
      }} />
  }
}

export default class App extends React.Component {
  static Layout = Layout

  render() {
    return <BrowserRouter>
      <Layout />
    </BrowserRouter>
  }
}
