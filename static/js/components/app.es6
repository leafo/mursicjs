
let {Router, Route, IndexRoute, Link, browserHistory, withRouter} = ReactRouter
let {CSSTransitionGroup} = React.addons || {}


let MidiButton = (props) =>
  <button
    onClick={(e) => {
      e.preventDefault()
      props.pickMidi()
    }}
    className="midi_button">
      <img src="/static/svg/midi.svg" alt="MIDI" />
      <span className="current_input_name">
        {props.midiInput ? props.midiInput.name : "Select device"}
      </span>
  </button>

class Layout extends React.Component {
  constructor(props) {
    super(props)
    this.state = {}

    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then(
        midi => this.setState({midi: midi}),
        error => console.warn("failed to get MIDI"))
    }
  }

  componentDidMount() {
    N.dispatch(this, {
      "closeLightbox": (e) => this.setState({currentLightbox: null}),
      "showLightbox": (e, lb) => {
        this.setState({
          currentLightbox: lb
        })
      },
      "pickMidi": (e) => {
        this.setState({
          currentLightbox: <IntroLightbox
            setInput={this.setInput.bind(this)} />
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
      midiInput: this.state.midiInput
    }
  }

  render() {
    let children = React.cloneElement(this.props.children, Object.assign({
      ref: "currentPage"
    }, this.childProps()))

    return <div className="page_layout">
      <div className="header_spacer">
        {this.renderHeader()}
      </div>
      {children}

      <CSSTransitionGroup transitionName="show_lightbox" transitionEnterTimeout={200} transitionLeaveTimeout={100}>
        {this.renderCurrentLightbox()}
      </CSSTransitionGroup>
    </div>
  }

  renderCurrentLightbox() {
    if (!this.state.currentLightbox) { return }

    let lb = React.cloneElement(this.state.currentLightbox, Object.assign({
      ref: "currentLightbox"
    }, this.childProps()))

    return <div
      className="lightbox_shroud"
      onClick={(e) => {
        if (e.target.classList.contains("lightbox_shroud")) {
          this.refs.currentLightbox.close()
          e.preventDefault();
        }
      }}
      >{lb}</div>
  }

  doLogout() {
    let request = new XMLHttpRequest()
    request.open("POST", "/logout.json")
    let data = new FormData()
    data.append("csrf_token", N.csrf_token())
    request.send(data)

    request.onload = (e) => {
      let res = JSON.parse(request.responseText)
      N.init(res)
    }
  }

  renderHeader() {
    let userLinks = [
      <Link key="root" onlyActiveOnIndex to="/" activeClassName="active">Staff</Link>,
      <Link key="flash-cards" to="/flash-cards" activeClassName="active">Flash cards</Link>
    ]

    if (N.session.currentUser) {
      var userPanel = <div className="right_section">
        {N.session.currentUser.username}
        {" " }
        <a href="#" onClick={this.doLogout.bind(this)}>Log out</a>
      </div>

      userLinks.push(<Link
          key="stats"
          to="/stats"
          activeClassName="active">Stats</Link>)

    } else {
      var userPanel = <div className="right_section">
        <Link to="/login" activeClassName="active">Log in</Link>
        {" or "}
        <Link to="/register" activeClassName="active">Register</Link>
      </div>
    }
    return <div className="header">
      <img className="logo" src="/static/img/logo.svg" height="40" alt="" />

      <h1>
        <Link to="/">Sight reading trainer</Link>
      </h1>

      {userLinks}
      {userPanel}
      <MidiButton {...this.childProps()} pickMidi={() => N.trigger(this, "pickMidi")} />
    </div>
  }

  midiInputs() {
    if (!this.state.midi) return;
    return [...this.state.midi.inputs.values()];
  }

  setInput(idx) {
    let input = this.midiInputs()[idx]
    if (!input) { return; }
    if (this.state.midiInput) {
      console.log(`Unbinding: ${this.state.midiInput.name}`)
      this.state.midiInput.onmidimessage = undefined
    }

    console.log(`Binding to: ${input.name}`)
    input.onmidimessage = this.onMidiMessage.bind(this)

    this.setState({
      midiInput: input
    });
  }

  onMidiMessage(message) {
    // ignore midi events when the browser tab isn't active
    if (document.hidden) return;
    
    // proxy message to the current page
    if (this.refs.currentPage.onMidiMessage) {
      this.refs.currentPage.onMidiMessage(message)
    }
  }
}

class App extends React.Component {
  constructor() {
    super()
    this.state = {
      routes: <Route path="/" component={withRouter(Layout)}>
        <IndexRoute component={SightReadingPage}></IndexRoute>
        <Route path="login" component={withRouter(LoginPage)}></Route>
        <Route path="register" component={withRouter(RegisterPage)}></Route>
        <Route path="about" component={withRouter(AboutPage)}></Route>
        <Route path="stats" component={withRouter(StatsPage)}></Route>
        <Route path="flash-cards" component={FlashCardPage}></Route>
      </Route>
    }
  }

  render() {
    return <Router history={browserHistory}>{this.state.routes}</Router>
  }
}
